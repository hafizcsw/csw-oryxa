-- Backfill display_text for published enrichment facts based on fact_key signal types
-- MIT facts
UPDATE entity_enrichment_facts SET display_text = 'Strong AI integration across curriculum with dedicated computing infrastructure' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'ai_integration__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Applied learning programs with industry partnerships and hands-on projects' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'applied_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Curriculum updated frequently to reflect emerging technologies' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'curriculum_update_velocity__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Flexible learning options including hybrid and self-paced tracks' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'flexible_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Advanced research computing facilities available to students' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'research_compute__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Transparent data reporting and institutional openness' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'transparency_data_freshness__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Positive verified student outcome signals' WHERE entity_id = '985c3211-7429-48f0-a120-bcb7688ef931' AND fact_key LIKE 'student_signal__%' AND status = 'published';

-- Cambridge facts
UPDATE entity_enrichment_facts SET display_text = 'AI and machine learning integration in academic programs' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'ai_integration__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Applied learning through research partnerships and practical projects' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'applied_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Regular curriculum updates reflecting latest academic research' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'curriculum_update_velocity__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Flexible study arrangements and interdisciplinary options' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'flexible_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'World-class research computing and laboratory resources' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'research_compute__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Strong data transparency and open reporting practices' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'transparency_data_freshness__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Strong verified student satisfaction signals' WHERE entity_id = 'ccf6e28b-d96e-4048-bcfb-8809b9fac171' AND fact_key LIKE 'student_signal__%' AND status = 'published';

-- Oxford facts
UPDATE entity_enrichment_facts SET display_text = 'Integration of AI tools and methods in academic programs' WHERE entity_id = '161523ba-1055-4915-8cb5-72deff3f9376' AND fact_key LIKE 'ai_integration__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Applied learning through tutorial system and hands-on research' WHERE entity_id = '161523ba-1055-4915-8cb5-72deff3f9376' AND fact_key LIKE 'applied_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Curriculum evolving with emerging fields and technologies' WHERE entity_id = '161523ba-1055-4915-8cb5-72deff3f9376' AND fact_key LIKE 'curriculum_update_velocity__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Flexible academic structure with modular course options' WHERE entity_id = '161523ba-1055-4915-8cb5-72deff3f9376' AND fact_key LIKE 'flexible_learning__%' AND status = 'published';

-- Stanford facts
UPDATE entity_enrichment_facts SET display_text = 'Deep AI and technology integration across departments' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'ai_integration__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Applied learning through Silicon Valley industry connections' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'applied_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Rapid curriculum evolution aligned with industry trends' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'curriculum_update_velocity__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Highly flexible study paths with interdisciplinary options' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'flexible_learning__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'State-of-the-art research computing infrastructure' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'research_compute__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'High transparency in institutional data and outcomes' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'transparency_data_freshness__%' AND status = 'published';
UPDATE entity_enrichment_facts SET display_text = 'Excellent verified student satisfaction and outcomes' WHERE entity_id = 'cf203ec0-8a44-4906-8bcd-f081d0de6845' AND fact_key LIKE 'student_signal__%' AND status = 'published';