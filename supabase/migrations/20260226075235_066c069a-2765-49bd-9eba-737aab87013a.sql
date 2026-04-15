
-- Infer degree_level from program title patterns for Russian programs
UPDATE program_draft SET degree_level = 
  CASE
    WHEN title ~* 'LLM|LL\.M' THEN 'master'
    WHEN title ~* '\mMBA\M' THEN 'master'
    WHEN title ~* '\mPhD\M|\mDoctoral\M|\mPostgraduate\M|\mCandidate\M|\mAspiratura\M' THEN 'phd'
    WHEN title ~* '\mMaster|Magistracy|magistr\M' THEN 'master'
    WHEN title ~* '\mBachelor|Bakalavr\M|\mBNI\M|\mundergraduate\M' THEN 'bachelor'
    WHEN title ~* '\mSpecialist|Specialty|Specialitet\M' THEN 'specialist'
    WHEN title ~* '\mResidency|Ordinatura\M' THEN 'residency'
    WHEN title ~* '\mPreparatory|Foundation\M' THEN 'preparatory'
    ELSE 'bachelor'  -- default for Russian programs without explicit level
  END
WHERE country_code = 'RU' AND degree_level IS NULL;
