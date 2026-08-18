export type Language = 'zh' | 'en';
const STORAGE_KEY = 'arttrans_language';

export function getLanguage(): Language {
  return (localStorage.getItem(STORAGE_KEY) as Language) || 'zh';
}
export function setLanguage(lang: Language): void {
  localStorage.setItem(STORAGE_KEY, lang);
}

const translations = {
  zh: {
    // App
    'app.title': 'ArtTrans Workbench',
    'app.subtitle': '本地术语库 · 直连 AI 翻译',

    // Settings
    'settings.title': '⚙ 设置',
    'settings.provider': 'AI Provider',
    'settings.apiKey': 'API Key',
    'settings.model': 'Model',
    'settings.baseUrl': 'Base URL',
    'settings.batchSize': '每批翻译段数',
    'settings.save': '保存设置',
    'settings.saved': '✓ 已保存',

    // History
    'history.title': '📚 翻译历史',
    'history.empty': '暂无翻译历史',
    'history.chapters': '章',
    'history.segments': '段',

    // Batch Replace
    'batch.title': '🔍 批量替换术语译法',
    'batch.from': '替换',
    'batch.fromPlaceholder': '输入要替换的词或译法',
    'batch.to': '替换为',
    'batch.toPlaceholder': '输入新的译法',
    'batch.hint': '将替换 {count} 处',
    'batch.replace': '确认替换',

    // Import
    'import.title': '📥 导入备份',
    'import.desc': '导入之前导出的术语表 JSON 备份文件',
    'import.select': '选择备份文件',

    // Glossary
    'glossary.title': '术语表',
    'glossary.search': '搜索原文、译名、出处',
    'glossary.source': '原文术语 / 专名',
    'glossary.trans': '中文译名，可用 ; 分隔',
    'glossary.provenance': '学术出处',
    'glossary.note': '释义 / 备注',
    'glossary.load': '加载术语表',
    'glossary.template': '下载模板',
    'glossary.add': '添加术语',
    'glossary.exportBackup': '导出备份',
    'glossary.importBackup': '导入备份',
    'glossary.page': '显示 {from}-{to} / {total}',
    'glossary.noData': '未找到有效术语数据',

    // Workbench
    'workbench.title': '翻译工作台',
    'workbench.hint': 'Ctrl+Enter 翻译 · Ctrl+Shift+S 标为已校',
    'workbench.loadBook': '加载书籍',
    'workbench.translateNext': '翻译下一批',
    'workbench.direct': '直接翻译',
    'workbench.translating': '翻译中...',
    'workbench.placeholder': '粘贴原文或加载书籍文件...',
    'workbench.progress': '翻译进度',
    'workbench.stat': '{translated}/{total} 段已译 · {reviewed} 段已校',
    'workbench.termCoverage': '术语覆盖率',
    'workbench.chapter': '章节',
    'workbench.exportTxt': '导出 TXT',
    'workbench.exportDoc': '导出 DOC',
    'workbench.directTranslate': '直接翻译',
    'workbench.quickTranslate': '快速翻译',
    'workbench.closeBook': '关闭书籍',
    'workbench.clearQuickTranslate': '清除',
    'workbench.saveSession': '保存会话',
    'workbench.loadSession': '加载会话',

    // Segment
    'segment.edit': '整段编辑',
    'segment.mark': '标为已校',
    'segment.unmark': '取消已校',
    'segment.pending': '待翻译',
    'segment.status.pending': '待译',
    'segment.status.translated': '已译',
    'segment.status.reviewed': '已校',
    'segment.status.translating': '翻译中',

    // Discovery
    'discovery.title': '🔍 AI 发现的未登记术语',

    // Inspector
    'inspector.title': '术语校订',
    'inspector.empty': '点击译文中的术语词块，在这里选择译法、手动修订，或保存为术语表记录。',
    'inspector.current': '当前译法',
    'inspector.confirm': '确认译法',
    'inspector.reconfirm': '重新确认',
    'inspector.addToGlossary': '加入术语表',

    // Categories & Langs
    'category.term': '术语',
    'category.proper': '专名',
    'category.style': '风格/流派',
    'lang.en': '英语',
    'lang.de': '德语',
    'lang.it': '意语',
    'lang.fr': '法语',
    'lang.auto': '自动',

    // Theme
    'theme.history': '历史',
    'theme.light': '切换亮色模式',
    'theme.dark': '切换暗色模式',

    // Common
    'common.delete': '删除',
    'common.close': '关闭',
    'common.prev': '上一页',
    'common.next': '下一页',

    // Toast
    'toast.importing': '正在导入...',
    'toast.importDone': '导入完成：新增 {imported} 条，合并 {merged} 条',
    'toast.importFailed': '导入失败',
    'toast.fileFormatError': '文件格式错误',
    'toast.exported': '术语表已导出',
    'toast.deleted': '已删除',
    'toast.bookLoaded': '已加载：{title}，{chapters}章，{segments}段',
    'toast.noBook': '请先加载书籍',
    'toast.noApiKey': '请先在设置中配置 API Key',
    'toast.noText': '请先粘贴要翻译的原文',
    'toast.allDone': '本书已全部翻译完成！',
    'toast.batchDone': '本批完成：{count} 段',
    'toast.translatedCount': '已翻译 {count} 段',
    'toast.translateError': '翻译出错：',
    'toast.loadFailed': '加载失败',
    'toast.exportSuccess': '导出成功',
    'toast.exportFailed': '导出失败',
    'toast.termAdded': '已添加术语：{term}',
    'toast.termMerged': '已合并到已有术语：{term}',
    'toast.verified': '已确认译法',
    'toast.updated': '译法已更新',
    'toast.reviewed': '已标记为已校',
    'toast.unreviewed': '已取消已校标记',
    'toast.replaced': '已替换 {count} 处',
    'toast.savedGlossary': '已保存到术语表',
    'toast.sessionRestored': '已恢复会话：{title}',
    'toast.bookClosed': '会话已关闭，可以开始新的翻译',
    'toast.quickTranslateCleared': '已清除快速翻译结果',
  },

  en: {
    // App
    'app.title': 'ArtTrans Workbench',
    'app.subtitle': 'Local Glossary · Direct AI Translation',

    // Settings
    'settings.title': '⚙ Settings',
    'settings.provider': 'AI Provider',
    'settings.apiKey': 'API Key',
    'settings.model': 'Model',
    'settings.baseUrl': 'Base URL',
    'settings.batchSize': 'Segments per batch',
    'settings.save': 'Save Settings',
    'settings.saved': '✓ Saved',

    // History
    'history.title': '📚 Translation History',
    'history.empty': 'No translation history',
    'history.chapters': 'ch',
    'history.segments': 'seg',

    // Batch Replace
    'batch.title': '🔍 Batch Replace Terms',
    'batch.from': 'Replace',
    'batch.fromPlaceholder': 'Enter word or translation to replace',
    'batch.to': 'Replace with',
    'batch.toPlaceholder': 'Enter new translation',
    'batch.hint': 'Will replace {count} occurrences',
    'batch.replace': 'Confirm Replace',

    // Import
    'import.title': '📥 Import Backup',
    'import.desc': 'Import a previously exported glossary JSON backup file',
    'import.select': 'Select backup file',

    // Glossary
    'glossary.title': 'Glossary',
    'glossary.search': 'Search source, translations, provenance',
    'glossary.source': 'Source term / proper noun',
    'glossary.trans': 'Chinese translation, separated by ;',
    'glossary.provenance': 'Academic source',
    'glossary.note': 'Definition / Notes',
    'glossary.load': 'Load Glossary',
    'glossary.template': 'Download Template',
    'glossary.add': 'Add Term',
    'glossary.exportBackup': 'Export Backup',
    'glossary.importBackup': 'Import Backup',
    'glossary.page': 'Showing {from}-{to} of {total}',
    'glossary.noData': 'No valid glossary data found',

    // Workbench
    'workbench.title': 'Translation Workbench',
    'workbench.hint': 'Ctrl+Enter to translate · Ctrl+Shift+S to mark reviewed',
    'workbench.loadBook': 'Load Book',
    'workbench.translateNext': 'Translate Next Batch',
    'workbench.direct': 'Direct Translate',
    'workbench.translating': 'Translating...',
    'workbench.placeholder': 'Paste source text or load a book file...',
    'workbench.progress': 'Translation Progress',
    'workbench.stat': '{translated}/{total} translated · {reviewed} reviewed',
    'workbench.termCoverage': 'Term Coverage',
    'workbench.chapter': 'Chapter',
    'workbench.exportTxt': 'Export TXT',
    'workbench.exportDoc': 'Export DOC',
    'workbench.directTranslate': 'Direct Translate',
    'workbench.quickTranslate': 'Quick Translate',
    'workbench.closeBook': 'Close Book',
    'workbench.clearQuickTranslate': 'Clear',
    'workbench.saveSession': 'Save Session',
    'workbench.loadSession': 'Load Session',

    // Segment
    'segment.edit': 'Edit Full Segment',
    'segment.mark': 'Mark Reviewed',
    'segment.unmark': 'Unmark Reviewed',
    'segment.pending': 'Pending translation',
    'segment.status.pending': 'Pending',
    'segment.status.translated': 'Translated',
    'segment.status.reviewed': 'Reviewed',
    'segment.status.translating': 'Translating',

    // Discovery
    'discovery.title': '🔍 Unregistered Terms Found by AI',

    // Inspector
    'inspector.title': 'Term Review',
    'inspector.empty': 'Click on a term in the translation to select a translation, edit manually, or save to glossary.',
    'inspector.current': 'Current Translation',
    'inspector.confirm': 'Confirm Translation',
    'inspector.reconfirm': 'Re-confirm',
    'inspector.addToGlossary': 'Add to Glossary',

    // Categories & Langs
    'category.term': 'Term',
    'category.proper': 'Proper Noun',
    'category.style': 'Style/Period',
    'lang.en': 'English',
    'lang.de': 'German',
    'lang.it': 'Italian',
    'lang.fr': 'French',
    'lang.auto': 'Auto',

    // Theme
    'theme.history': 'History',
    'theme.light': 'Switch to light mode',
    'theme.dark': 'Switch to dark mode',

    // Common
    'common.delete': 'Delete',
    'common.close': 'Close',
    'common.prev': 'Prev',
    'common.next': 'Next',

    // Toast
    'toast.importing': 'Importing...',
    'toast.importDone': 'Import complete: {imported} added, {merged} merged',
    'toast.importFailed': 'Import failed',
    'toast.fileFormatError': 'File format error',
    'toast.exported': 'Glossary exported',
    'toast.deleted': 'Deleted',
    'toast.bookLoaded': 'Loaded: {title}, {chapters} chapters, {segments} segments',
    'toast.noBook': 'Please load a book first',
    'toast.noApiKey': 'Please configure API Key in Settings',
    'toast.noText': 'Please paste text to translate',
    'toast.allDone': 'Book fully translated!',
    'toast.batchDone': 'Batch complete: {count} segments',
    'toast.translatedCount': 'Translated {count} segments',
    'toast.translateError': 'Translation error: ',
    'toast.loadFailed': 'Load failed',
    'toast.exportSuccess': 'Export successful',
    'toast.exportFailed': 'Export failed',
    'toast.termAdded': 'Term added: {term}',
    'toast.termMerged': 'Merged with existing: {term}',
    'toast.verified': 'Translation verified',
    'toast.updated': 'Translation updated',
    'toast.reviewed': 'Marked as reviewed',
    'toast.unreviewed': 'Unmarked as reviewed',
    'toast.replaced': 'Replaced {count} occurrences',
    'toast.savedGlossary': 'Saved to glossary',
    'toast.sessionRestored': 'Session restored: {title}',
    'toast.bookClosed': 'Book closed, ready for new translation',
    'toast.quickTranslateCleared': 'Quick translation cleared',
  },
};

export function t(key: string, params?: Record<string, string | number>): string {
  const lang = getLanguage();
  const dict = translations[lang] || translations.zh;
  let text = dict[key as keyof typeof dict] || translations.zh[key as keyof typeof translations.zh] || key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}
