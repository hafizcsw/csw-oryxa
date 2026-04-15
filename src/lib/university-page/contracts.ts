export type UniversityPageRole = 'owner' | 'admin' | 'editor' | 'publisher' | 'moderator' | 'viewer';

export type PageStaffRole =
  | 'full_control'
  | 'page_admin'
  | 'content_publisher'
  | 'moderator'
  | 'inbox_agent'
  | 'analyst'
  | 'live_community_manager';

export interface UniversityPageMedia {
  coverUrl: string | null;
  logoUrl: string | null;
}

export interface UniversityPageMember {
  id: string;
  userId: string;
  role: UniversityPageRole;
  displayName?: string | null;
}

export interface UniversityPagePost {
  id: string;
  message: string;
  createdAt: string;
  authorName?: string | null;
}

export interface UniversityInboxThread {
  id: string;
  subject: string;
  lastMessageAt: string;
}

/**
 * Permission matrix for page staff roles.
 * Maps each action to the roles that can perform it.
 */
export const PAGE_PERMISSION_MATRIX: Record<string, PageStaffRole[]> = {
  // Staff management
  'staff.list': ['full_control', 'page_admin'],
  'staff.add': ['full_control', 'page_admin'],
  'staff.update_role': ['full_control'],
  'staff.remove': ['full_control', 'page_admin'],

  // Posts
  'posts.create': ['full_control', 'page_admin', 'content_publisher'],
  'posts.update': ['full_control', 'page_admin', 'content_publisher'],
  'posts.delete': ['full_control', 'page_admin'],

  // Comments / moderation
  'comments.moderate': ['full_control', 'page_admin', 'moderator'],
  'comments.moderation_queue': ['full_control', 'page_admin', 'moderator'],
  'moderation.restrict_user': ['full_control', 'page_admin', 'moderator'],
  'moderation.unrestrict_user': ['full_control', 'page_admin', 'moderator'],
  'moderation.keyword_filters': ['full_control', 'page_admin', 'moderator'],

  // Inbox
  'inbox.threads': ['full_control', 'page_admin', 'inbox_agent'],
  'inbox.reply': ['full_control', 'page_admin', 'inbox_agent'],
  'inbox.update_thread': ['full_control', 'page_admin', 'inbox_agent'],
  'inbox.saved_replies': ['full_control', 'page_admin', 'inbox_agent'],

  // Settings
  'settings.get': ['full_control', 'page_admin', 'content_publisher', 'moderator', 'inbox_agent', 'analyst', 'live_community_manager'],
  'settings.set': ['full_control', 'page_admin'],

  // Analytics
  'analytics.summary': ['full_control', 'page_admin', 'analyst'],

  // Activity log
  'activity.list': ['full_control', 'page_admin'],
};

export interface UniversitySocialBridge {
  getUniversityPageMedia(universityId: string): Promise<UniversityPageMedia>;
  updateUniversityPageCover(universityId: string, payload: { coverImageUrl: string; governanceMode?: 'approval' | 'direct_publish' }): Promise<{ ok: boolean; proposalId?: string; autoPublished?: boolean }>;
  updateUniversityPageLogo(universityId: string, payload: { logoUrl: string; governanceMode?: 'approval' | 'direct_publish' }): Promise<{ ok: boolean; proposalId?: string; autoPublished?: boolean }>;
  listUniversityPageMembers(universityId: string): Promise<UniversityPageMember[]>;
  assignUniversityPageRole(universityId: string, payload: { userId: string; role: UniversityPageRole }): Promise<{ ok: boolean }>;
  revokeUniversityPageRole(universityId: string, payload: { userId: string }): Promise<{ ok: boolean }>;
  listUniversityPagePosts(universityId: string): Promise<UniversityPagePost[]>;
  createUniversityPagePost(universityId: string, payload: { message: string }): Promise<{ ok: boolean; postId?: string }>;
  listUniversityInboxThreads(universityId: string): Promise<UniversityInboxThread[]>;
  sendUniversityInboxReply(universityId: string, payload: { threadId: string; message: string }): Promise<{ ok: boolean }>;
}
