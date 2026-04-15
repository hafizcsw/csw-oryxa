-- ===== Contract Templates & Electronic Contracts =====

-- Contract templates table
CREATE TABLE IF NOT EXISTS contract_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body_html text NOT NULL,
  version int DEFAULT 1,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Student contracts
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  template_id uuid REFERENCES contract_templates(id),
  data jsonb,
  status text CHECK (status IN ('draft','signed','void')) DEFAULT 'draft',
  html_render text,
  pdf_path text,
  created_at timestamptz DEFAULT now(),
  signed_at timestamptz
);

-- Contract signatures (audit trail)
CREATE TABLE IF NOT EXISTS contract_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid REFERENCES contracts(id) ON DELETE CASCADE,
  signer_user_id uuid,
  method text CHECK (method IN ('clickwrap','draw')) DEFAULT 'clickwrap',
  ip text,
  user_agent text,
  signed_at timestamptz DEFAULT now(),
  signature_image_path text
);

-- ===== Translation System =====

-- Translation templates (notary-style designs)
CREATE TABLE IF NOT EXISTS translation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text CHECK (kind IN ('passport','highschool','residency','other')) NOT NULL,
  locale text DEFAULT 'ar',
  body_html text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Translation requests
CREATE TABLE IF NOT EXISTS translation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_user_id uuid NOT NULL,
  doc_kind text CHECK (doc_kind IN ('passport','highschool','residency','other')) NOT NULL,
  source_lang text DEFAULT 'ar',
  target_lang text DEFAULT 'en',
  input_path text,
  status text CHECK (status IN ('pending','processing','done','error')) DEFAULT 'pending',
  provider text DEFAULT 'simple_bot',
  output_pdf_path text,
  created_at timestamptz DEFAULT now(),
  last_error text
);

-- ===== RLS Policies =====

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE translation_requests ENABLE ROW LEVEL SECURITY;

-- Contracts: students can read their own, admins can read all
CREATE POLICY contracts_self_read ON contracts FOR SELECT
USING (auth.uid() = student_user_id OR is_admin(auth.uid()));

CREATE POLICY contracts_self_insert ON contracts FOR INSERT
WITH CHECK (auth.uid() = student_user_id OR is_admin(auth.uid()));

CREATE POLICY contracts_self_update ON contracts FOR UPDATE
USING (auth.uid() = student_user_id OR is_admin(auth.uid()))
WITH CHECK (auth.uid() = student_user_id OR is_admin(auth.uid()));

-- Signatures: read only for owner and admins
CREATE POLICY signatures_read ON contract_signatures FOR SELECT
USING (auth.uid() = signer_user_id OR is_admin(auth.uid()));

-- Translation requests: students can read their own, admins can manage
CREATE POLICY tr_self_read ON translation_requests FOR SELECT
USING (auth.uid() = student_user_id OR is_admin(auth.uid()));

CREATE POLICY tr_admin_write ON translation_requests FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY tr_admin_update ON translation_requests FOR UPDATE
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

-- ===== Insert Default Templates =====

-- Default contract template
INSERT INTO contract_templates(title, body_html, version, is_active) VALUES
('اتفاقية خدمة الطالب - v1',
'<div dir="rtl" style="font-family: Cairo, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto;">
  <h1 style="text-align: center; color: #1a1a1a; margin-bottom: 30px;">اتفاقية خدمة الطالب</h1>
  
  <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
    <p><strong>بين:</strong> {{company.name}} ("المؤسسة")</p>
    <p><strong>و:</strong> {{student.full_name}} ("الطالب")</p>
    <p><strong>البريد الإلكتروني:</strong> {{student.email}}</p>
    <p><strong>الهاتف:</strong> {{student.phone}}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <h3>تفاصيل البرنامج</h3>
    <p><strong>البرنامج:</strong> {{program.name}}</p>
    <p><strong>الدولة:</strong> {{program.country}}</p>
    <p><strong>الرسوم:</strong> {{payment.amount}} {{payment.currency}}</p>
    <p><strong>سياسة الاسترجاع:</strong> {{policy.refund}}</p>
  </div>

  <div style="margin-bottom: 30px;">
    <h3>الشروط والأحكام</h3>
    <ol style="line-height: 1.8;">
      <li>يلتزم الطالب بتقديم مستندات صحيحة ومكتملة.</li>
      <li>تقتصر إجابات المساعد الذكي على بيانات موقعنا فقط.</li>
      <li>الدفع داخل بوابة الطالب فقط، والاتفاق نافذ عند التوقيع.</li>
      <li>تحتفظ المؤسسة بحق تعديل الشروط مع إشعار مسبق.</li>
    </ol>
  </div>

  <div style="margin-top: 40px; padding: 20px; background: #fff3cd; border-radius: 8px;">
    <p style="margin: 0; font-weight: bold;">بالضغط على "أُقِرّ وأوقّع"، فأنت توافق على جميع الشروط المذكورة أعلاه.</p>
  </div>

  <div style="margin-top: 30px; text-align: center; font-size: 14px; color: #6c757d;">
    <p>تاريخ الإنشاء: {{today}}</p>
  </div>
</div>', 1, true);

-- Default translation template (passport)
INSERT INTO translation_templates(kind, locale, body_html, is_active) VALUES
('passport', 'ar',
'<div dir="rtl" style="font-family: Cairo, sans-serif; border: 3px solid #1a1a1a; padding: 40px; max-width: 800px; margin: 0 auto;">
  <div style="text-align: center; margin-bottom: 40px;">
    <h1 style="color: #1a1a1a; margin: 0;">ترجمة رسمية</h1>
    <h2 style="color: #666; margin: 10px 0 0 0;">جواز سفر</h2>
    <div style="width: 100px; height: 3px; background: #1a1a1a; margin: 20px auto;"></div>
  </div>

  <div style="background: #f8f9fa; padding: 30px; border-radius: 8px; margin-bottom: 30px;">
    <table style="width: 100%; border-collapse: collapse;">
      <tr style="border-bottom: 1px solid #dee2e6;">
        <td style="padding: 15px; font-weight: bold; width: 30%;">الاسم الكامل:</td>
        <td style="padding: 15px;">{{t.name}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #dee2e6;">
        <td style="padding: 15px; font-weight: bold;">رقم الجواز:</td>
        <td style="padding: 15px;">{{t.passport_number}}</td>
      </tr>
      <tr style="border-bottom: 1px solid #dee2e6;">
        <td style="padding: 15px; font-weight: bold;">الجنسية:</td>
        <td style="padding: 15px;">{{t.nationality}}</td>
      </tr>
      <tr>
        <td style="padding: 15px; font-weight: bold;">تاريخ الميلاد:</td>
        <td style="padding: 15px;">{{t.birth_date}}</td>
      </tr>
    </table>
  </div>

  <div style="border-top: 2px solid #dee2e6; padding-top: 30px; margin-top: 40px;">
    <p style="font-size: 14px; color: #666; line-height: 1.6;">
      تم إعداد هذه الترجمة بناءً على المستند الأصلي المرفق. الترجمة معتمدة ومطابقة للأصل.
    </p>
    <div style="margin-top: 30px; text-align: center;">
      <p style="font-weight: bold; margin: 0;">{{company.seal_text}}</p>
      <p style="font-size: 12px; color: #999; margin: 10px 0 0 0;">ختم المترجم المعتمد</p>
    </div>
  </div>
</div>', true);