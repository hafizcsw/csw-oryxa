
-- Clear old testimonials
DELETE FROM testimonials;

-- Insert 7 new AI + Education expert videos (multilingual)
INSERT INTO testimonials (student_name, video_url, thumbnail_url, quote, "order", featured) VALUES
('Sal Khan – TED Talk', 'https://www.youtube.com/watch?v=hJP5GqnTrNo', 'https://i.ytimg.com/vi/hJP5GqnTrNo/maxresdefault.jpg', 'How AI Could Save (Not Destroy) Education', 1, true),
('AI & Education Summit', 'https://www.youtube.com/watch?v=Y9xA3itXQes', 'https://i.ytimg.com/vi/Y9xA3itXQes/maxresdefault.jpg', 'The future of learning in the age of AI', 2, true),
('硅谷101 – AI与教育', 'https://www.youtube.com/watch?v=vZ1kAuU_ogw', 'https://i.ytimg.com/vi/vZ1kAuU_ogw/maxresdefault.jpg', 'AI将淘汰不愿改革的学校', 3, true),
('Philippe Meirieu – L''École face à l''IA', 'https://www.youtube.com/watch?v=F4yTM0GKHUs', 'https://i.ytimg.com/vi/F4yTM0GKHUs/maxresdefault.jpg', 'L''intelligence artificielle et l''avenir de l''éducation', 4, true),
('AI in Education', 'https://www.youtube.com/watch?v=ssZZJ5ArWLo', 'https://i.ytimg.com/vi/ssZZJ5ArWLo/maxresdefault.jpg', 'How AI is transforming the classroom', 5, true),
('PIVOT – AI時代の大学教育', 'https://www.youtube.com/watch?v=2NHxpUzWt-Y', 'https://i.ytimg.com/vi/2NHxpUzWt-Y/maxresdefault.jpg', 'AI時代に必要な教育とは', 6, true),
('Stanford HAI – AI+Education 2025', 'https://www.youtube.com/watch?v=LhEfJ5kxEbY', 'https://i.ytimg.com/vi/LhEfJ5kxEbY/maxresdefault.jpg', 'AI''s Impact on Education – A Visionary Conversation', 7, true);
