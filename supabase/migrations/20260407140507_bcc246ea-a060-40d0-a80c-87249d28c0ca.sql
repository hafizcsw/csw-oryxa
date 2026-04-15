
-- Fill missing services for Africa (id: f85dfe44-a051-45f7-8f9f-4efd55f8f14e)
INSERT INTO public.paid_services (region_id, category, name_key, description_key, tier, price_usd, is_popular, features, display_order) VALUES
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'language_course', 'services.lang.intensive', 'services.lang.intensiveDesc', 'intensive', 520, false, '["services.feat.fullCurriculum","services.feat.dailyLessons","services.feat.privateSessions","services.feat.uniPrep","services.feat.prioritySupport","services.feat.certificate"]', 3),
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'student_service', 'services.student.housing', 'services.student.housingDesc', NULL, 100, false, '["services.feat.dormArrangement","services.feat.contractAssist"]', 2),
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'student_service', 'services.student.airport', 'services.student.airportDesc', NULL, 50, false, '["services.feat.airportPickup","services.feat.cityTransfer"]', 3),
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'student_service', 'services.student.bank', 'services.student.bankDesc', NULL, 35, false, '["services.feat.accountOpening","services.feat.docTranslation"]', 4),
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'admission', 'services.admission.fullTrack', 'services.admission.fullTrackDesc', NULL, 380, true, '["services.feat.uniSelection","services.feat.docReview","services.feat.applicationSubmit","services.feat.followUp","services.feat.acceptanceLetter","services.feat.visaSupport"]', 2),
('f85dfe44-a051-45f7-8f9f-4efd55f8f14e', 'bundle', 'services.bundle.starter', 'services.bundle.starterDesc', 'starter', 420, false, '["services.feat.langRegular","services.feat.visaService","services.feat.airportPickup"]', 1),

-- Fill missing services for South America (id: 575646a3-17f6-45bb-91a2-e0b05557eee8)
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'language_course', 'services.lang.intensive', 'services.lang.intensiveDesc', 'intensive', 580, false, '["services.feat.fullCurriculum","services.feat.dailyLessons","services.feat.privateSessions","services.feat.uniPrep","services.feat.prioritySupport","services.feat.certificate"]', 3),
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'student_service', 'services.student.housing', 'services.student.housingDesc', NULL, 110, false, '["services.feat.dormArrangement","services.feat.contractAssist"]', 2),
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'student_service', 'services.student.airport', 'services.student.airportDesc', NULL, 55, false, '["services.feat.airportPickup","services.feat.cityTransfer"]', 3),
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'student_service', 'services.student.bank', 'services.student.bankDesc', NULL, 38, false, '["services.feat.accountOpening","services.feat.docTranslation"]', 4),
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'admission', 'services.admission.fullTrack', 'services.admission.fullTrackDesc', NULL, 420, true, '["services.feat.uniSelection","services.feat.docReview","services.feat.applicationSubmit","services.feat.followUp","services.feat.acceptanceLetter","services.feat.visaSupport"]', 2),
('575646a3-17f6-45bb-91a2-e0b05557eee8', 'bundle', 'services.bundle.starter', 'services.bundle.starterDesc', 'starter', 480, false, '["services.feat.langRegular","services.feat.visaService","services.feat.airportPickup"]', 1),

-- Fill missing services for North America (id: d1a5694c-ffc1-4e76-a905-651c5e67d81e)
('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'language_course', 'services.lang.intensive', 'services.lang.intensiveDesc', 'intensive', 1000, false, '["services.feat.fullCurriculum","services.feat.dailyLessons","services.feat.privateSessions","services.feat.uniPrep","services.feat.prioritySupport","services.feat.certificate"]', 3),
('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'student_service', 'services.student.airport', 'services.student.airportDesc', NULL, 100, false, '["services.feat.airportPickup","services.feat.cityTransfer"]', 3),
('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'student_service', 'services.student.bank', 'services.student.bankDesc', NULL, 80, false, '["services.feat.accountOpening","services.feat.docTranslation"]', 4),
('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'admission', 'services.admission.apply', 'services.admission.applyDesc', NULL, 400, false, '["services.feat.uniSelection","services.feat.docReview","services.feat.applicationSubmit","services.feat.followUp"]', 1),
('d1a5694c-ffc1-4e76-a905-651c5e67d81e', 'bundle', 'services.bundle.starter', 'services.bundle.starterDesc', 'starter', 900, false, '["services.feat.langRegular","services.feat.visaService","services.feat.airportPickup"]', 1),

-- Fill missing services for Oceania (id: ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b)
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'language_course', 'services.lang.intensive', 'services.lang.intensiveDesc', 'intensive', 1100, false, '["services.feat.fullCurriculum","services.feat.dailyLessons","services.feat.privateSessions","services.feat.uniPrep","services.feat.prioritySupport","services.feat.certificate"]', 3),
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'student_service', 'services.student.housing', 'services.student.housingDesc', NULL, 280, false, '["services.feat.dormArrangement","services.feat.contractAssist"]', 2),
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'student_service', 'services.student.airport', 'services.student.airportDesc', NULL, 90, false, '["services.feat.airportPickup","services.feat.cityTransfer"]', 3),
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'student_service', 'services.student.bank', 'services.student.bankDesc', NULL, 70, false, '["services.feat.accountOpening","services.feat.docTranslation"]', 4),
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'admission', 'services.admission.apply', 'services.admission.applyDesc', NULL, 450, false, '["services.feat.uniSelection","services.feat.docReview","services.feat.applicationSubmit","services.feat.followUp"]', 1),
('ba2ffdb6-0a84-4a44-908f-47f9d2cdd40b', 'bundle', 'services.bundle.starter', 'services.bundle.starterDesc', 'starter', 950, false, '["services.feat.langRegular","services.feat.visaService","services.feat.airportPickup"]', 1);
