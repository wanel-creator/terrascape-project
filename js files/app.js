import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://xbmvqccmlbgsgeebnnfv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibXZxY2NtbGJnc2dlZWJubmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTg4NDksImV4cCI6MjEwMzEzNDg0OX0.6a5FljFNpGkfYw0hPQ133QjgYc1jM28mkiaJYTfuCvk'
);

const showMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.className = `mt-4 min-h-6 rounded border px-3 py-2 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-100 text-orange-800'}`;
};

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

const ensureAgentContactDetails = async () => {
    const { data: profileData, error: profileError } = await supabase.from('profiles').select('full_name, phone').eq('id', user.id).single();
    if (profileError) {
        throw profileError;
    }

    const currentPhone = (profileData?.phone || '').trim();
    const existingName = (profileData?.full_name || 'Agent').trim();

    let phone = currentPhone;
    if (!phone) {
        const enteredPhone = window.prompt('Enter the phone number clients should use to reach you:', '');
        if (!enteredPhone || !enteredPhone.trim()) {
            throw new Error('A valid phone number is required before accepting a request.');
        }
        phone = enteredPhone.trim();
        const { error: phoneError } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
        if (phoneError) {
            throw phoneError;
        }
    }

    const email = user.email?.trim() || '';
    if (!email) {
        throw new Error('Your email is missing from your account. Please update it and try again.');
    }

    return { full_name: existingName, phone, email };
};

const { data: { user } } = await supabase.auth.getUser();
if (!user) {
    window.location.href = 'loginform.html';
    throw new Error('Authentication required');
}

const { data: profile } = await supabase.from('profiles').select('full_name, role').eq('id', user.id).single();
if (!profile) {
    window.location.href = 'loginform.html';
    throw new Error('Profile required');
}

document.querySelector('#signOutButton')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = 'loginform.html';
});

const requestForm = document.querySelector('#agentRequestForm');
if (requestForm) {
    document.querySelector('#userGreeting').textContent = `Signed in as ${profile.full_name}`;
    const requestList = document.querySelector('#requestList');
    const loadRequests = async () => {
        const { data, error } = await supabase.from('agent_requests').select('service, location, details, status, created_at, agent_id, agent_contact_name, agent_contact_phone, agent_contact_email, agent:profiles!agent_requests_agent_id_fkey(full_name, email, phone)').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) {
            showMessage(document.querySelector('#requestMessage'), error.message, true);
            return;
        }

        requestList.innerHTML = data.length ? data.map((request) => {
            const contactName = request.agent_contact_name || request.agent?.full_name || 'Agent';
            const contactPhone = request.agent_contact_phone || request.agent?.phone || 'Not provided';
            const contactEmail = request.agent_contact_email || request.agent?.email || 'Not provided';
            const hasContact = request.status === 'matched' && (contactPhone !== 'Not provided' || contactEmail !== 'Not provided');

            return `<article class="rounded border border-orange-200 bg-orange-50 p-4">
                <p class="font-bold text-orange-900">${escapeHtml(request.service)}</p>
                <p class="text-sm text-gray-600">${escapeHtml(request.location)}</p>
                <p class="mt-2 text-sm">Status: <strong>${escapeHtml(request.status)}</strong></p>
                ${hasContact ? `<div class="mt-3 border-t border-orange-200 pt-3 text-sm text-green-700"><p class="font-semibold">Accepted agent: ${escapeHtml(contactName)}</p><p>Email: <a class="underline" href="mailto:${encodeURIComponent(contactEmail)}">${escapeHtml(contactEmail)}</a></p><p>Phone: <a class="underline" href="tel:${encodeURIComponent(contactPhone)}">${escapeHtml(contactPhone)}</a></p></div>` : ''}
            </article>`;
        }).join('') : '<p class="text-gray-600">You have not made a request yet.</p>';
    };
    await loadRequests();
    requestForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const message = document.querySelector('#requestMessage');
        const { data: agents, error: agentError } = await supabase.from('agent_profiles').select('id').eq('service', document.querySelector('#requestService').value).eq('available', true).ilike('location', `%${document.querySelector('#requestLocation').value.trim()}%`);
        if (agentError) {
            showMessage(message, agentError.message, true);
            return;
        }
        const agent = agents[0];
        const { error } = await supabase.from('agent_requests').insert({
            user_id: user.id,
            service: document.querySelector('#requestService').value,
            location: document.querySelector('#requestLocation').value.trim(),
            details: document.querySelector('#requestDetails').value.trim(),
            agent_id: agent?.id || null,
            status: agent ? 'matched' : 'open'
        });
        if (error) {
            showMessage(message, error.message, true);
            return;
        }
        requestForm.reset();
        showMessage(message, agent ? 'An agent is available and has been notified.' : 'No agent is available yet. We will keep your request open.');
        await loadRequests();
    });
}

const agentList = document.querySelector('#agentRequestList');
if (agentList) {
    document.querySelector('#agentGreeting').textContent = `Signed in as ${profile.full_name}`;
    const profileForm = document.querySelector('#agentProfileForm');
    const profileService = document.querySelector('#profileService');
    const profileLocation = document.querySelector('#profileLocation');
    const profilePhone = document.querySelector('#profilePhone');
    const profileBio = document.querySelector('#profileBio');
    const profileAvailable = document.querySelector('#profileAvailable');
    const profileMessage = document.querySelector('#agentProfileMessage');

    const loadAgentProfile = async () => {
        const [{ data: agentDetails, error: agentError }, { data: profileDetails, error: profileError }] = await Promise.all([
            supabase.from('agent_profiles').select('service, location, bio, available').eq('id', user.id).maybeSingle(),
            supabase.from('profiles').select('phone').eq('id', user.id).single()
        ]);

        if (agentError && agentError.code !== 'PGRST116') {
            showMessage(profileMessage, agentError.message, true);
        }
        if (profileError && profileError.code !== 'PGRST116') {
            showMessage(profileMessage, profileError.message, true);
        }

        if (!agentDetails) {
            return;
        }

        profileService.value = agentDetails.service || 'house hunting';
        profileLocation.value = agentDetails.location || '';
        profilePhone.value = profileDetails?.phone || '';
        profileBio.value = agentDetails.bio || '';
        profileAvailable.checked = agentDetails.available !== false;

        document.querySelector('#agentService').textContent = `${agentDetails.service} agent serving ${agentDetails.location}`;
    };

    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const service = profileService.value.trim();
        const location = profileLocation.value.trim();
        const phone = profilePhone.value.trim();
        if (!service || !location || !phone) {
            showMessage(profileMessage, 'Please provide your service, service location, and phone number.', true);
            return;
        }

        const payload = {
            id: user.id,
            service,
            location,
            bio: profileBio.value.trim(),
            available: profileAvailable.checked
        };

        const { error } = await supabase.from('agent_profiles').upsert(payload, { onConflict: 'id' });
        if (error) {
            showMessage(profileMessage, error.message, true);
            return;
        }

        const { error: profileUpdateError } = await supabase.from('profiles').update({ phone }).eq('id', user.id);
        if (profileUpdateError) {
            showMessage(profileMessage, profileUpdateError.message, true);
            return;
        }

        showMessage(profileMessage, 'Your profile has been saved.');
        document.querySelector('#agentService').textContent = `${service} agent serving ${location}`;
        const { data: requests, error: requestError } = await supabase.from('agent_requests').select('id, service, location, details, created_at, user_id').eq('status', 'open').eq('service', service).order('created_at', { ascending: false });
        if (requestError) {
            agentList.textContent = requestError.message;
            return;
        }
        agentList.innerHTML = requests.length ? requests.map((request) => `<article class="rounded border border-orange-400 bg-white p-6 shadow-md"><h2 class="text-xl font-bold text-orange-900">${escapeHtml(request.service)}</h2><p class="mt-2 text-gray-600">${escapeHtml(request.location)}</p><p class="mt-3 text-sm">${escapeHtml(request.details || 'No extra details provided.')}</p><button class="accept-request mt-5 rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600" data-request-id="${escapeHtml(request.id)}" type="button">Accept request</button></article>`).join('') : '<p class="text-gray-600">There are no open requests for your service.</p>';
        agentList.querySelectorAll('.accept-request').forEach((button) => button.addEventListener('click', async () => {
            button.disabled = true;
            const { error: acceptError } = await supabase.from('agent_requests').update({ agent_id: user.id, status: 'matched' }).eq('id', button.dataset.requestId).eq('status', 'open');
            if (acceptError) {
                button.disabled = false;
                button.textContent = acceptError.message;
                return;
            }
            button.textContent = 'Request accepted';
        }));
    });

    await loadAgentProfile();

    const { data: requests, error } = await supabase.from('agent_requests').select('id, service, location, details, created_at, user_id').eq('status', 'open').eq('service', profileService.value || '').order('created_at', { ascending: false });
    if (error) {
        agentList.textContent = error.message;
    } else {
        agentList.innerHTML = requests.length ? requests.map((request) => `<article class="rounded border border-orange-400 bg-white p-6 shadow-md"><h2 class="text-xl font-bold text-orange-900">${escapeHtml(request.service)}</h2><p class="mt-2 text-gray-600">${escapeHtml(request.location)}</p><p class="mt-3 text-sm">${escapeHtml(request.details || 'No extra details provided.')}</p><button class="accept-request mt-5 rounded bg-orange-500 px-4 py-2 font-semibold text-white hover:bg-orange-600" data-request-id="${escapeHtml(request.id)}" type="button">Accept request</button></article>`).join('') : '<p class="text-gray-600">There are no open requests for your service.</p>';
        agentList.querySelectorAll('.accept-request').forEach((button) => button.addEventListener('click', async () => {
            button.disabled = true;
            const requestId = button.dataset.requestId;
            try {
                const { full_name, phone, email } = await ensureAgentContactDetails();
                const { error: acceptError } = await supabase.from('agent_requests').update({
                    agent_id: user.id,
                    status: 'matched',
                    agent_contact_name: full_name,
                    agent_contact_phone: phone,
                    agent_contact_email: email
                }).eq('id', requestId).eq('status', 'open');

                if (acceptError) {
                    throw acceptError;
                }

                button.textContent = 'Request accepted';
                const message = document.querySelector('#agentProfileMessage') || document.querySelector('#agentGreeting');
                if (message) {
                    showMessage(message, 'Your contact details have been shared with the client. They can now contact you.', false);
                }
            } catch (error) {
                button.disabled = false;
                button.textContent = 'Accept request';
                const message = document.querySelector('#agentProfileMessage') || document.querySelector('#agentGreeting');
                if (message) {
                    showMessage(message, error.message || 'Please add a contact number before accepting requests.', true);
                }
            }
        }));
    }
}
