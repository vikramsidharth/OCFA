-- Registration Requests Table Schema
-- This table stores registration requests that need approval before being added to the users table

-- Create sequence for registration_requests table
CREATE SEQUENCE IF NOT EXISTS registration_requests_id_seq;

-- Table: public.registration_requests
CREATE TABLE IF NOT EXISTS public.registration_requests (
    id integer NOT NULL DEFAULT nextval('registration_requests_id_seq'::regclass),
    username character varying(50) COLLATE pg_catalog."default" NOT NULL,
    password character varying(100) COLLATE pg_catalog."default" NOT NULL,
    name character varying(100) COLLATE pg_catalog."default" NOT NULL,
    role character varying(20) COLLATE pg_catalog."default" NOT NULL,
    email character varying(100) COLLATE pg_catalog."default",
    category character varying(50) COLLATE pg_catalog."default",
    age integer,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'pending'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    processed_at timestamp without time zone,
    gender character varying(20) COLLATE pg_catalog."default",
    height character varying(10) COLLATE pg_catalog."default",
    weight character varying(10) COLLATE pg_catalog."default",
    bp character varying(20) COLLATE pg_catalog."default",
    id_no character varying(50) COLLATE pg_catalog."default",
    blood_group character varying(10) COLLATE pg_catalog."default",
    unit_name character varying(100) COLLATE pg_catalog."default",
    phone character varying(20) COLLATE pg_catalog."default",
    user_id integer,
    updated_at timestamp without time zone,
    phone_no character varying(20) COLLATE pg_catalog."default",
    CONSTRAINT registration_requests_pkey PRIMARY KEY (id),
    CONSTRAINT registration_requests_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES public.users (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
);

-- Create indexes for better performance and uniqueness constraints
CREATE UNIQUE INDEX IF NOT EXISTS ux_regreq_email_pending
    ON public.registration_requests USING btree
    (lower(email::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE status::text = 'pending'::text AND email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_regreq_idno_pending
    ON public.registration_requests USING btree
    (lower(id_no::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE status::text = 'pending'::text AND id_no IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_regreq_username_pending
    ON public.registration_requests USING btree
    (lower(username::text) COLLATE pg_catalog."default" ASC NULLS LAST)
    TABLESPACE pg_default
    WHERE status::text = 'pending'::text;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_registration_requests_updated_at 
    BEFORE UPDATE ON registration_requests
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed for your setup)
-- ALTER TABLE public.registration_requests OWNER to vikram;
