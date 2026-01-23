DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'service_id'
    ) THEN
        ALTER TABLE payments ADD COLUMN service_id UUID REFERENCES services(id);
        CREATE INDEX idx_payments_service_id ON payments(service_id);
        COMMENT ON COLUMN payments.service_id IS 'Links payment to the service/agent that was called';
    END IF;
END $$;
