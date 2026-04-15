-- Enable admin insert/update/delete for testimonials table
create policy "Admins can manage testimonials"
on testimonials
for all
using (true)
with check (true);

-- Add sample testimonials data
insert into testimonials (student_name, video_url, thumbnail_url, quote, "order", featured)
values
  (
    'Ahmed Al-Masri',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
    'Studying in Germany changed my life! The quality of education and support from CSW was exceptional.',
    1,
    true
  ),
  (
    'Fatima Hassan',
    'https://www.youtube.com/watch?v=jNQXAC9IVRw',
    'https://img.youtube.com/vi/jNQXAC9IVRw/maxresdefault.jpg',
    'My journey to the UK was seamless thanks to the amazing team. I recommend CSW to all students!',
    2,
    true
  ),
  (
    'Omar Khalil',
    'https://www.youtube.com/watch?v=9bZkp7q19f0',
    'https://img.youtube.com/vi/9bZkp7q19f0/maxresdefault.jpg',
    'From visa to accommodation, everything was handled professionally. I am now studying my dream program in Canada!',
    3,
    false
  ),
  (
    'Sara Mohammed',
    'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    'https://img.youtube.com/vi/kJQP7kiw5Fk/maxresdefault.jpg',
    'The best decision I made was choosing CSW for my study abroad journey. Highly recommended!',
    4,
    false
  ),
  (
    'Youssef Ibrahim',
    'https://www.youtube.com/watch?v=L_jWHffIx5E',
    'https://img.youtube.com/vi/L_jWHffIx5E/maxresdefault.jpg',
    'Excellent service and support throughout my entire application process. Thank you CSW!',
    5,
    false
  );