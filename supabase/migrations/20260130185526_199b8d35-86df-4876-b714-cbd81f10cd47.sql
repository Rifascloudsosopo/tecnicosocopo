-- Remove admin role from the old user and assign to the correct admin
DELETE FROM public.user_roles WHERE user_id = '26146af7-8c2e-4b41-88c9-aff2dbd78a82' AND role = 'admin';

-- Assign admin role to supertecnicodesocopo@gmail.com
INSERT INTO public.user_roles (user_id, role)
VALUES ('5781fd57-e8e2-4668-8a14-9f5d884fcb79', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;