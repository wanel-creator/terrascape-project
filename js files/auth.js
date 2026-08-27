import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://xbmvqccmlbgsgeebnnfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhibXZxY2NtbGJnc2dlZWJubmZ2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NTg4NDksImV4cCI6MjEwMzEzNDg0OX0.6a5FljFNpGkfYw0hPQ133QjgYc1jM28mkiaJYTfuCvk';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const setMessage = (element, message, isError = false) => {
    element.textContent = message;
    element.className = `mt-4 min-h-6 text-sm ${isError ? 'text-red-600' : 'text-green-700'}`;
};

const isEmailTimeout = (error) => {
    const details = `${error?.status || ''} ${error?.message || error || ''}`.toLowerCase();
    return details.includes('504') || details.includes('gateway timeout');
};

const isEmailRateLimited = (error) => {
    const details = `${error?.status || ''} ${error?.message || error || ''}`.toLowerCase();
    return details.includes('429') || details.includes('rate limit') || details.includes('too many requests');
};

const emailTimeoutMessage = 'Supabase timed out while sending the email. Check your inbox and spam folder before trying again. If no email arrives, wait a few minutes and click Resend code.';
const emailRateLimitMessage = 'Too many confirmation emails were requested. Wait a while before trying again, then use Resend code once.';

const getRegistrationData = () => JSON.parse(localStorage.getItem('pendingRegistration') || 'null');

const getProfile = async (userId) => {
    const { data, error } = await supabase.from('profiles').select('full_name, role').eq('id', userId).single();
    return { profile: data, error };
};

const loginForm = document.querySelector('#loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = loginForm.querySelector('button[type="submit"]');
        const message = document.querySelector('#loginMessage');
        button.disabled = true;
        setMessage(message, 'Signing you in...');

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
    });
}

const registrationForm = document.querySelector('#registrationForm');
if (registrationForm) {
    const roleSelect = document.querySelector('#registerRole');
    const agentFields = document.querySelector('#agentFields');
    roleSelect.addEventListener('change', () => {
        agentFields.hidden = roleSelect.value !== 'agent';
        document.querySelector('#agentService').required = roleSelect.value === 'agent';
        document.querySelector('#agentLocation').required = roleSelect.value === 'agent';
    });

    registrationForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const button = registrationForm.querySelector('button[type="submit"]');
        const message = document.querySelector('#registrationMessage');
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
        localStorage.setItem('pendingRegistration', JSON.stringify(registrationData));

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
                const userMessage = isEmailRateLimited(error)
                    ? emailRateLimitMessage
                    : isEmailTimeout(error) ? emailTimeoutMessage : error.message;
                setMessage(message, userMessage, true);
                if (isEmailTimeout(error)) {
                    document.querySelector('#verificationStep').hidden = false;
                }
                button.disabled = false;
                return;
            }

            if (data.session) {
                document.querySelector('#verificationStep').hidden = true;
                setMessage(message, 'Account created, but email confirmation is disabled in Supabase. Enable Confirm email in Authentication settings to send OTP codes.', true);
                button.hidden = true;
                return;
            }

            document.querySelector('#verificationStep').hidden = false;
            setMessage(message, 'Check your email and spam folder for the confirmation code, then enter it below.');
            button.hidden = true;
        } catch (error) {
            const errorMessage = error.message || '';
            const userMessage = isEmailTimeout(error)
                ? emailTimeoutMessage
                : isEmailRateLimited(error) ? emailRateLimitMessage
                : errorMessage || 'Unable to contact Supabase. Check your internet connection and try again.';
            setMessage(message, userMessage, true);
            if (isEmailTimeout(error)) {
                document.querySelector('#verificationStep').hidden = false;
            }
            button.disabled = false;
        }
    });
}

const verifyForm = document.querySelector('#verificationForm');
if (verifyForm) {
    const verifyButton = verifyForm.querySelector('button[type="button"]');
    verifyButton.addEventListener('click', async () => {
        const button = verifyButton;
        const message = document.querySelector('#registrationMessage');
        const pending = getRegistrationData();
        const code = document.querySelector('#verificationCode').value.trim();
        if (!pending || !code) {
            setMessage(message, 'Enter the code sent to your email.', true);
            return;
        }
        button.disabled = true;
        setMessage(message, 'Verifying your code...');

        const { data, error } = await supabase.auth.verifyOtp({
            email: pending?.email,
            token: document.querySelector('#verificationCode').value.trim(),
            type: 'signup'
        });

        if (error || !pending || !data.user) {
            setMessage(message, error?.message || 'Your registration details have expired. Please register again.', true);
            button.disabled = false;
            return;
        }

        if (pending.role === 'agent') {
            const { error: agentError } = await supabase.from('agent_profiles').upsert({
                id: data.user.id,
                service: pending.service,
                location: pending.location,
                bio: pending.bio
            });
            if (agentError) {
                setMessage(message, agentError.message, true);
                button.disabled = false;
                return;
            }
        }

        localStorage.removeItem('pendingRegistration');
        setMessage(message, 'Email confirmed. You can now log in.');
        document.querySelector('#verificationCode').value = '';
        document.querySelector('#registrationForm').reset();
        button.hidden = true;
    });

    document.querySelector('#resendCodeButton').addEventListener('click', async () => {
        const pending = getRegistrationData();
        const message = document.querySelector('#registrationMessage');
        if (!pending?.email) {
            setMessage(message, 'Register again to request a new code.', true);
            return;
        }
        try {
            const { error } = await supabase.auth.resend({ type: 'signup', email: pending.email });
            const userMessage = error
                ? isEmailRateLimited(error) ? emailRateLimitMessage : error.message
                : 'A new confirmation code has been sent.';
            setMessage(message, userMessage, Boolean(error));
        } catch (error) {
            const userMessage = isEmailRateLimited(error)
                ? emailRateLimitMessage
                : error.message || 'Unable to resend the confirmation code. Try again shortly.';
            setMessage(message, userMessage, true);
        }
    });
}