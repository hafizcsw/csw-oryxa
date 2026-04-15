-- LAV #15.2: Document & Payment Status RPCs

-- RPC لتحديث حالة الوثائق (Approve All)
CREATE OR REPLACE FUNCTION public.app_docs_approve_all(p_application_id uuid, p_reviewer_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  -- تحديث حالة جميع الوثائق
  UPDATE application_documents
  SET status = 'approved'
  WHERE application_id = p_application_id AND status IN ('uploaded', 'pending');
  
  -- تسجيل الحدث
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'docs_approved', 'All documents approved', p_reviewer_id, 'admin');
  
  -- الحصول على معلومات الزائر للإشعار
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    -- إضافة إشعار واتساب
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'docs_approved',
              jsonb_build_object('phone', v_phone), 'queued');
    END IF;
  END IF;
  
  -- إضافة حدث تتبع
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('doc_status_changed', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'status', 'approved',
    'reviewer_id', p_reviewer_id
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'docs_approved'
  );
  
  RETURN v_result;
END;
$$;

-- RPC لرفض الوثائق
CREATE OR REPLACE FUNCTION public.app_docs_reject(
  p_application_id uuid, 
  p_reviewer_id text,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  -- تحديث حالة الوثائق
  UPDATE application_documents
  SET status = 'rejected'
  WHERE application_id = p_application_id;
  
  -- تسجيل الحدث مع السبب
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'docs_rejected', p_reason, p_reviewer_id, 'admin');
  
  -- الحصول على معلومات الزائر
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    -- إضافة إشعار
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'docs_rejected',
              jsonb_build_object('phone', v_phone, 'reason', p_reason), 'queued');
    END IF;
  END IF;
  
  -- إضافة حدث تتبع
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('doc_status_changed', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'status', 'rejected',
    'reason', p_reason,
    'reviewer_id', p_reviewer_id
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'docs_rejected',
    'reason', p_reason
  );
  
  RETURN v_result;
END;
$$;

-- RPC لتحديث حالة الدفع
CREATE OR REPLACE FUNCTION public.app_payment_success(
  p_application_id uuid,
  p_payment_ref text,
  p_amount numeric,
  p_currency text DEFAULT 'USD'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_visitor text;
  v_phone text;
  v_result jsonb;
BEGIN
  -- تحديث حالة الطلب
  UPDATE applications
  SET status = 'paid'
  WHERE id = p_application_id;
  
  -- تسجيل الحدث
  INSERT INTO application_status_events(application_id, status, note, created_by, channel)
  VALUES (p_application_id, 'paid', 
          format('Payment successful: %s %s (ref: %s)', p_amount, p_currency, p_payment_ref),
          'payment_gateway', 'system');
  
  -- الحصول على معلومات الزائر
  SELECT visitor_id INTO v_visitor FROM applications WHERE id = p_application_id;
  IF v_visitor IS NOT NULL THEN
    SELECT phone INTO v_phone FROM phone_identities WHERE visitor_id = v_visitor LIMIT 1;
    
    -- إضافة إشعار
    IF v_phone IS NOT NULL THEN
      INSERT INTO notifications(visitor_id, application_id, channel, template_key, payload, status)
      VALUES (v_visitor, p_application_id, 'whatsapp', 'payment_success',
              jsonb_build_object('phone', v_phone, 'amount', p_amount, 'currency', p_currency), 
              'queued');
    END IF;
  END IF;
  
  -- إضافة حدث تتبع
  INSERT INTO events(name, visitor_id, properties)
  VALUES ('payment_success', v_visitor, jsonb_build_object(
    'application_id', p_application_id,
    'amount', p_amount,
    'currency', p_currency,
    'payment_ref', p_payment_ref
  ));
  
  v_result := jsonb_build_object(
    'ok', true,
    'application_id', p_application_id,
    'status', 'paid',
    'payment_ref', p_payment_ref
  );
  
  RETURN v_result;
END;
$$;