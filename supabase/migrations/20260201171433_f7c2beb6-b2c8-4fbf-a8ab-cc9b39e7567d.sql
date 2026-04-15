-- إضافة فهرس فريد على cwur_world_rank لمنع التكرار مستقبلاً
CREATE UNIQUE INDEX IF NOT EXISTS universities_cwur_world_rank_unique 
ON universities(cwur_world_rank) 
WHERE cwur_world_rank IS NOT NULL;