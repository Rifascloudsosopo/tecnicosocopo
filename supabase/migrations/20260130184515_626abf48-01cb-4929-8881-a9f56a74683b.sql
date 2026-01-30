-- Assign admin role to the first user (leonardyjhn@gmail.com)
INSERT INTO public.user_roles (user_id, role)
VALUES ('26146af7-8c2e-4b41-88c9-aff2dbd78a82', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;