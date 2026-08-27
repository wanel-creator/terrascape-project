import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
    'https://xbmvqccmlbgsgeebnnfv.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibXZxY2NtbGJnc2dlZWJubmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTg4NDksImV4cCI6MjEwMzEzNDg0OX0.6a5FljFNpGkfYw0hPQ133QjgYc1jM28mkiaJYTfuCvk'
);

const showMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.className = `mt-4 min-h-6 text-sm ${isError ? 'text-red-600' : 'text-green-700'}`;
};

const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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
        const { data, error } = await supabase.from('agent_requests').select('service, location, details, status, created_at, agent_id, agent:profiles!agent_requests_agent_id_fkey(full_name, email, phone)').eq('user_id', user.id).order('created_at', { ascending: false });
        if (error) {
            showMessage(document.querySelector('#requestMessage'), error.message, true);
            return;
        }
            requestList.innerHTML = data.length ? data.map((request) => `<article class="rounded border border-orange-200 bg-orange-50 p-4"><p class="font-bold text-orange-900">${escapeHtml(request.service)}</p><p class="text-sm text-gray-600">${escapeHtml(request.location)}</p><p class="mt-2 text-sm">Status: <strong>${escapeHtml(request.status)}</strong></p>${request.agent_id && request.agent ? `<div class="mt-3 border-t border-orange-200 pt-3 text-sm text-green-700"><p class="font-semibold">Agent: ${escapeHtml(request.agent.full_name)}</p><p>Email: <a class="underline" href="mailto:${encodeURIComponent(request.agent.email || '')}">${escapeHtml(request.agent.email)}</a></p><p>Phone: <a class="underline" href="tel:${encodeURIComponent(request.agent.phone || '')}">${escapeHtml(request.agent.phone || 'Not provided')}</a></p></div>` : ''}</article>`).join('') : '<p class="text-gray-600">You have not made a request yet.</p>';
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
    const { data: agentDetails } = await supabase.from('agent_profiles').select('service, location').eq('id', user.id).single();
    document.querySelector('#agentService').textContent = agentDetails ? `${agentDetails.service} agent serving ${agentDetails.location}` : 'Complete your agent profile to receive requests.';
    const { data: requests, error } = await supabase.from('agent_requests').select('id, service, location, details, created_at, user_id').eq('status', 'open').eq('service', agentDetails?.service || '').order('created_at', { ascending: false });
    if (error) {
        agentList.textContent = error.message;
    } else {
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
    }
}
