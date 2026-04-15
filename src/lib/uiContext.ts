/**
 * UI Context Helper for Chat Messages
 * يبني ui_context لكل رسالة ترسل للـ CRM
 */

export interface UiContextV1 {
  route: string;
  page: 'public' | 'programs' | 'account' | 'services' | 'payments' | 'shortlist' | 'documents' | 'other';
  tab: string | null;
  focused_field: string | null;
  lang: string;
  cards_visible?: boolean; // 🆕 Optional for pilot mode
}

/**
 * Determines the page type from pathname and tab
 */
function determinePage(pathname: string, tab: string | null): UiContextV1['page'] {
  if (pathname === '/' || pathname.startsWith('/country')) {
    return 'public';
  }
  
  if (pathname.startsWith('/search') || pathname.startsWith('/program') || pathname.startsWith('/university')) {
    return 'programs';
  }
  
  if (pathname.startsWith('/account')) {
    // Determine based on tab for /account routes
    if (tab === 'shortlist' || tab === 'favorites') return 'shortlist';
    if (tab === 'services') return 'services';
    if (tab === 'payments') return 'payments';
    if (tab === 'documents') return 'documents';
    return 'account';
  }
  
  return 'other';
}

/**
 * Builds UI Context from React Router values
 * ✅ لا يستخدم window.location - يستقبل القيم كـ parameters
 */
export function buildUiContextV1(params: {
  pathname: string;      // من useLocation().pathname
  tab: string | null;    // من searchParams.get('tab')
  lang: string;          // من useLanguage().language
  focusedField?: string | null;
}): UiContextV1 {
  const { pathname, tab, lang, focusedField } = params;
  
  return {
    route: pathname,
    page: determinePage(pathname, tab),
    tab: tab || null,
    focused_field: focusedField || null,
    lang
  };
}
