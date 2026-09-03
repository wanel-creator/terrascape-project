import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xbmvqccmlbgsgeebnnfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibXZxY2NtbGJnc2dlZWJubmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTg4NDksImV4cCI6MjEwMzEzNDg0OX0.6a5FljFNpGkfYw0hPQ133QjgYc1jM28mkiaJYTfuCvk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const setMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.className = `mt-4 min-h-6 rounded border px-3 py-2 text-sm ${isError ? 'border-red-200 bg-red-50 text-red-700' : 'border-orange-200 bg-orange-100 text-orange-800'}`;
};

const redirectAuthenticatedUser = async () => {
    const page = window.location.pathname.split('/').pop();
    if (!['loginform.html', 'registrationform.html', 'supabase-confirmation-email.html'].includes(page)) {
        return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return;
    }

    const { data: profile, error: profileError } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profileError || !profile) {
        return;
    }

    window.location.href = profile.role === 'agent' ? 'agent-dashboard.html' : 'agent-request.html';
};

const getProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('full_name, role').eq('id', userId).single();
    return { profile: data, error };
};

redirectAuthenticatedUser();

const loginForm = document.querySelector('#loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        const message = document.querySelector('#loginMessage');
        button.disabled = true;
        setMessage(message, 'Signing you in...');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email: document.querySelector('#loginEmail').value.trim(),
                password: document.querySelector('#loginPassword').value
            });

            if (error) {
                setMessage(message, error.message, true);
                button.disabled = false;
                return;
            }

            const { profile, error: profileError } = await getProfile(data.user.id);
            const selectedRole = document.querySelector('#loginRole').value;
            if (profileError || !profile || profile.role !== selectedRole) {
                await supabase.auth.signOut();
                setMessage(message, `This account is not registered as a ${selectedRole}.`, true);
                button.disabled = false;
                return;
            }

            setMessage(message, `Welcome, ${profile.full_name}.`);
            window.location.href = selectedRole === 'agent' ? 'agent-dashboard.html' : 'agent-request.html';
        } catch (error) {
            setMessage(message, error.message || 'Unable to contact Supabase. Try again shortly.', true);
            button.disabled = false;
        }
    });
}

const registrationForm = document.querySelector('#registrationForm');
if (registrationForm) {
    registrationForm.setAttribute('novalidate', 'novalidate');
    const roleSelect = document.querySelector('#registerRole');
    const agentFields = document.querySelector('#agentFields');
    const updateAgentFields = () => {
        agentFields.hidden = roleSelect.value !== 'agent';
        document.querySelector('#agentService').required = roleSelect.value === 'agent';
        document.querySelector('#agentLocation').required = roleSelect.value === 'agent';
    };
    roleSelect.addEventListener('change', updateAgentFields);
    updateAgentFields();

    registrationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = registrationForm.querySelector('button[type="submit"]');
        const message = document.querySelector('#registrationMessage');
        button.hidden = false;
        button.disabled = true;
        setMessage(message, 'Creating your account...');

        const role = document.querySelector('#registerRole').value;
        const registrationData = {
            fullName: document.querySelector('#fullName').value.trim(),
            email: document.querySelector('#registerEmail').value.trim(),
            phone: document.querySelector('#phone').value.trim(),
            role,
            service: document.querySelector('#agentService')?.value,
            location: document.querySelector('#agentLocation')?.value.trim(),
            bio: document.querySelector('#agentBio')?.value.trim()
        };
        try {
            const { data, error } = await supabase.auth.signUp({
                email: registrationData.email,
                password: document.querySelector('#registerPassword').value,
                options: {
                    data: {
                        full_name: registrationData.fullName,
                        phone: registrationData.phone,
                        role: registrationData.role
                    }
                }
            });

            if (error) {
                setMessage(message, error.message, true);
                button.disabled = false;
                return;
            }

            if (data.session) {
                setMessage(message, 'Account created, but email confirmation is disabled in Supabase. Enable Confirm email in Authentication settings to send OTP codes.', true);
                button.hidden = true;
                return;
            }

            setMessage(message, 'Your account was created. Check your email and follow the confirmation link to finish signing in.');
            button.hidden = true;
        } catch (error) {
            setMessage(message, error.message || 'Unable to contact Supabase. Check your internet connection and try again.', true);
            button.disabled = false;
        }
    });

    registrationForm.addEventListener('invalid', (event) => {
        event.preventDefault();
        const field = event.target;
        const message = document.querySelector('#registrationMessage');
        setMessage(message, field.validationMessage, true);
        field.focus();
    }, true);
}