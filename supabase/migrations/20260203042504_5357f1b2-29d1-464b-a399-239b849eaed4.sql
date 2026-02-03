-- Add admin role to new user (tecnifinity@gmail.com)
INSERT INTO public.user_roles (user_id, role)
VALUES ('0a950ddc-d47d-44c2-902d-632584bfd5e8', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Remove admin role from old user (supertecnicodesocopo@gmail.com)
DELETE FROM public.user_roles 
WHERE user_id = '5781fd57-e8e2-4668-8a14-9f5d884fcb79' AND role = 'admin';