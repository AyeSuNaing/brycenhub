/**
 * Project Setup Tab — i18n Dictionary (v5: +git commits keys)
 */

export type SetupI18nKey =
  | 'tabLabel' | 'cardTitle' | 'cardSubtitle'
  | 'btnGenerate' | 'btnRegenerate' | 'btnGenerating' | 'badgeGenerated'
  | 'prereqTitle' | 'prereqLine1' | 'prereqLine1Bold' | 'prereqLine2'
  | 'loadingGuide' | 'emptyTitle' | 'emptyDescBefore' | 'emptyDescAction' | 'emptyDescAfter' | 'emptyNoTech'
  | 'generatingTitle' | 'generatingDesc' | 'stackDetected'
  | 'copyBtn' | 'copiedBtn'
  | 'footerNote' | 'footerHintBefore' | 'footerHintAfter'
  | 'osPickerTitle' | 'osPickerHint' | 'osMacos' | 'osWindows' | 'osLinux' | 'osAutoDetected' | 'osForLabel'
  | 'fixErrorToggle' | 'fixErrorTitle' | 'fixErrorPlaceholder' | 'fixErrorButton'
  | 'fixErrorAnalyzing' | 'fixErrorProblem' | 'fixErrorSolution' | 'fixErrorExplanation'
  | 'fixErrorCommandsLabel' | 'fixErrorClose' | 'fixErrorFailed'
  | 'fixAttemptLabel' | 'fixAttemptDidNotWork' | 'fixAttemptTriedLabel'
  | 'fixBtnDidNotWork' | 'fixBtnWorked'
  | 'fixMaxAttemptsReached' | 'fixNewErrorPlaceholder' | 'fixPreviousAttempts'
  // ── Git Commits keys (NEW) ──
  | 'gitActivityTitle'
  | 'gitActivitySubtitle'
  | 'gitRefreshBtn'
  | 'gitViewOnGithub'
  | 'gitEmptyNoRepo'
  | 'gitEmptyNoRepoHint'
  | 'gitSetRepoBtn'
  | 'gitRepoUrlLabel'
  | 'gitRepoUrlPlaceholder'
  | 'gitTokenLabel'
  | 'gitTokenPlaceholder'
  | 'gitTokenHint'
  | 'gitSaveRepo'
  | 'gitCancelRepo'
  | 'gitLoadingCommits'
  | 'gitErrorRepoNotFound'
  | 'gitErrorRateLimited'
  | 'gitErrorInvalidToken'
  | 'gitErrorFetchFailed'
  | 'gitCommitCount'
  | 'gitJustNow'
  | 'gitMinutesAgo'
  | 'gitHoursAgo'
  | 'gitDaysAgo';

export type SetupI18nLang = 'en' | 'my' | 'ja' | 'vi' | 'ko' | 'km';

export const SETUP_I18N: Record<SetupI18nLang, Record<SetupI18nKey, string>> = {

  en: {
    tabLabel: '🚀 Setup',
    cardTitle: '🚀 Project Setup Guide',
    cardSubtitle: 'AI-generated commands to scaffold this project locally',
    btnGenerate: '🤖 Generate with AI',
    btnRegenerate: '🤖 Regenerate',
    btnGenerating: 'Generating...',
    badgeGenerated: '✓ Generated',
    prereqTitle: 'ℹ️ PREREQUISITES (PM RESPONSIBILITY)',
    prereqLine1: 'Before using this feature — PM must',
    prereqLine1Bold: 'create an empty GitHub repo and grant member permissions',
    prereqLine2: 'AI will generate scaffold + git push commands. PM runs them in a local terminal.',
    loadingGuide: 'Loading guide...',
    emptyTitle: 'No setup guide yet',
    emptyDescBefore: 'Click',
    emptyDescAction: 'Generate with AI',
    emptyDescAfter: 'above to create a step-by-step setup guide based on your tech stack.',
    emptyNoTech: '⚠️ Add tech stack first (Tech Stack tab) to generate commands',
    generatingTitle: 'AI is analyzing your project...',
    generatingDesc: 'Reading tech stack + generating setup commands',
    stackDetected: '📦 STACK DETECTED',
    copyBtn: '📋 Copy',
    copiedBtn: '✓ Copied',
    footerNote: '✨ Commands above are ready to copy-paste into your terminal.',
    footerHintBefore: 'Replace',
    footerHintAfter: 'with your actual GitHub repository URL.',
    osPickerTitle: '💻 Choose your operating system',
    osPickerHint: 'Commands will be tailored for your OS',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: 'Auto-detected',
    osForLabel: 'for',
    fixErrorToggle: '🐛 Got an error?',
    fixErrorTitle: 'AI Error Helper',
    fixErrorPlaceholder: 'Paste your error output here...',
    fixErrorButton: '🤖 Fix with AI',
    fixErrorAnalyzing: 'AI is analyzing the error...',
    fixErrorProblem: 'PROBLEM',
    fixErrorSolution: 'SOLUTION',
    fixErrorExplanation: 'WHY',
    fixErrorCommandsLabel: 'SUGGESTED FIX',
    fixErrorClose: 'Close',
    fixErrorFailed: 'Could not analyze the error. Please try again.',
    fixAttemptLabel: 'Attempt',
    fixAttemptDidNotWork: 'Did not work',
    fixAttemptTriedLabel: 'Tried',
    fixBtnDidNotWork: '❌ Did not work — try again',
    fixBtnWorked: '✓ Worked — close',
    fixMaxAttemptsReached: '⚠️ Maximum attempts reached (5). Please try a manual fix or consult documentation.',
    fixNewErrorPlaceholder: 'Paste the NEW error you got after trying the above fix...',
    fixPreviousAttempts: 'Previous attempts',
    gitActivityTitle: '🌿 Git Activity',
    gitActivitySubtitle: 'Recent commits from the linked repository',
    gitRefreshBtn: '🔄 Refresh',
    gitViewOnGithub: 'View all on GitHub ↗',
    gitEmptyNoRepo: 'Repository URL not set',
    gitEmptyNoRepoHint: 'Link a GitHub repository to see commit history here',
    gitSetRepoBtn: '🔗 Link GitHub Repo',
    gitRepoUrlLabel: 'Repository URL',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHub Token (optional, for private repos)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: 'Generate a Personal Access Token with "repo" scope at github.com/settings/tokens',
    gitSaveRepo: 'Save',
    gitCancelRepo: 'Cancel',
    gitLoadingCommits: 'Loading commits...',
    gitErrorRepoNotFound: 'Repository not found. Check the URL.',
    gitErrorRateLimited: 'Rate limited. Add a GitHub token for higher limits.',
    gitErrorInvalidToken: 'GitHub token is invalid or expired.',
    gitErrorFetchFailed: 'Failed to fetch commits',
    gitCommitCount: 'commits',
    gitJustNow: 'Just now',
    gitMinutesAgo: 'min ago',
    gitHoursAgo: 'hrs ago',
    gitDaysAgo: 'days ago',
  },

  my: {
    tabLabel: '🚀 Setup',
    cardTitle: '🚀 Project Setup လမ်းညွှန်',
    cardSubtitle: 'AI က ဒီ project ကို local မှာ scaffold လုပ်ရန် commands ထုတ်ပေး',
    btnGenerate: '🤖 AI ဖြင့် ထုတ်ယူရန်',
    btnRegenerate: '🤖 ပြန် Generate',
    btnGenerating: 'ထုတ်နေသည်...',
    badgeGenerated: '✓ ပြီးပြီ',
    prereqTitle: 'ℹ️ ကြိုတင်ပြုလုပ်ရန် (PM တာဝန်)',
    prereqLine1: 'ဒီ feature သုံးခင် — PM က',
    prereqLine1Bold: 'GitHub မှာ empty repo ဖန်တီးပြီး member permissions ပေးထားရမယ်',
    prereqLine2: 'AI က scaffold commands + git push commands generate ပေးမယ်။ PM က local terminal မှာ run လုပ်ပါ။',
    loadingGuide: 'လမ်းညွှန် ဖွင့်နေသည်...',
    emptyTitle: 'Setup guide မရှိသေးပါ',
    emptyDescBefore: 'အပေါ်က',
    emptyDescAction: 'AI ဖြင့် ထုတ်ယူရန်',
    emptyDescAfter: 'ကို နှိပ်ပြီး tech stack ပေါ်အခြေခံ step-by-step setup guide ဖန်တီးပါ။',
    emptyNoTech: '⚠️ Tech stack အရင်ထည့်ပါ (Tech Stack tab) — commands generate လုပ်ဖို့',
    generatingTitle: 'AI က သင့် project ကို စစ်ဆေးနေသည်...',
    generatingDesc: 'Tech stack ဖတ်ပြီး setup commands ထုတ်နေသည်',
    stackDetected: '📦 ရှာတွေ့သော STACK',
    copyBtn: '📋 ကူးယူ',
    copiedBtn: '✓ ကူးပြီးပြီ',
    footerNote: '✨ အထက်ပါ commands များ terminal ထဲ copy-paste ပြုလုပ်ရန် အဆင်သင့်။',
    footerHintBefore: 'ပြောင်းပါ —',
    footerHintAfter: 'ကို သင့်ရဲ့ actual GitHub repository URL နဲ့။',
    osPickerTitle: '💻 သင်သုံးတဲ့ operating system ရွေးပါ',
    osPickerHint: 'ရွေးထားတဲ့ OS အတွက် commands တွေ ထုတ်ပေးပါမယ်',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: 'အလိုအလျောက် သိရှိ',
    osForLabel: 'အတွက်',
    fixErrorToggle: '🐛 Error တက်သလား?',
    fixErrorTitle: 'AI Error ဖြေရှင်းပေးသူ',
    fixErrorPlaceholder: 'Error output ကို ဒီမှာ paste လုပ်ပါ...',
    fixErrorButton: '🤖 AI နဲ့ ဖြေရှင်း',
    fixErrorAnalyzing: 'AI က error ကို စစ်ဆေးနေသည်...',
    fixErrorProblem: 'ပြဿနာ',
    fixErrorSolution: 'ဖြေရှင်းနည်း',
    fixErrorExplanation: 'ဘာကြောင့်',
    fixErrorCommandsLabel: 'အကြံပြု Commands',
    fixErrorClose: 'ပိတ်',
    fixErrorFailed: 'Error ကို စစ်ဆေးလို့ မရပါ။ ပြန်ကြိုးစားပါ။',
    fixAttemptLabel: 'ကြိုးစားမှု',
    fixAttemptDidNotWork: 'အလုပ်မဖြစ်ခဲ့',
    fixAttemptTriedLabel: 'ကြိုးစားခဲ့',
    fixBtnDidNotWork: '❌ မဖြစ်ပါ — ထပ်ကြိုးစား',
    fixBtnWorked: '✓ အလုပ်ဖြစ်ပြီ — ပိတ်',
    fixMaxAttemptsReached: '⚠️ အကြိမ်များပြီ (5)။ manual လုပ်တာ သို့ documentation ကြည့်ပါ။',
    fixNewErrorPlaceholder: 'အထက်က fix ကို run ပြီး ရတဲ့ NEW error ကို ဒီမှာ paste လုပ်ပါ...',
    fixPreviousAttempts: 'အရင်ကြိုးစားမှုများ',
    gitActivityTitle: '🌿 Git Activity',
    gitActivitySubtitle: 'ချိတ်ဆက်ထားသော repository ရဲ့ မကြာသေးမီ commits',
    gitRefreshBtn: '🔄 ပြန်ယူ',
    gitViewOnGithub: 'GitHub မှာ အားလုံး ကြည့် ↗',
    gitEmptyNoRepo: 'Repository URL မထည့်ရသေးပါ',
    gitEmptyNoRepoHint: 'Commit history မြင်ရန် GitHub repository ချိတ်ဆက်ပါ',
    gitSetRepoBtn: '🔗 GitHub Repo ချိတ်ဆက်',
    gitRepoUrlLabel: 'Repository URL',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHub Token (optional — private repos အတွက်)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: '"repo" scope ပါတဲ့ Personal Access Token ကို github.com/settings/tokens မှာ ဖန်တီးပါ',
    gitSaveRepo: 'သိမ်း',
    gitCancelRepo: 'ပိတ်',
    gitLoadingCommits: 'Commits တွေ ဖွင့်နေသည်...',
    gitErrorRepoNotFound: 'Repository မတွေ့ပါ။ URL စစ်ကြည့်ပါ။',
    gitErrorRateLimited: 'Rate limit ပြည့်သွားပြီ။ GitHub token ထည့်ပါ။',
    gitErrorInvalidToken: 'GitHub token မမှန်ပါ။',
    gitErrorFetchFailed: 'Commits ယူလို့ မရပါ',
    gitCommitCount: 'commits',
    gitJustNow: 'ခုလေးတင်',
    gitMinutesAgo: 'မိနစ်က',
    gitHoursAgo: 'နာရီက',
    gitDaysAgo: 'ရက်က',
  },

  ja: {
    tabLabel: '🚀 セットアップ',
    cardTitle: '🚀 プロジェクトセットアップガイド',
    cardSubtitle: 'AIがこのプロジェクトをローカルでscaffoldするコマンドを生成',
    btnGenerate: '🤖 AIで生成',
    btnRegenerate: '🤖 再生成',
    btnGenerating: '生成中...',
    badgeGenerated: '✓ 生成済み',
    prereqTitle: 'ℹ️ 前提条件 (PMの責任)',
    prereqLine1: 'この機能を使う前に — PMは',
    prereqLine1Bold: '空のGitHubリポジトリを作成し、メンバー権限を付与する必要があります',
    prereqLine2: 'AIがscaffold + git pushコマンドを生成します。',
    loadingGuide: 'ガイドを読み込み中...',
    emptyTitle: 'セットアップガイドがまだありません',
    emptyDescBefore: '上の',
    emptyDescAction: 'AIで生成',
    emptyDescAfter: 'をクリックしてセットアップガイドを作成してください。',
    emptyNoTech: '⚠️ 先に技術スタックを追加してください',
    generatingTitle: 'AIがプロジェクトを分析中...',
    generatingDesc: 'セットアップコマンドを生成中',
    stackDetected: '📦 検出されたスタック',
    copyBtn: '📋 コピー',
    copiedBtn: '✓ コピー済み',
    footerNote: '✨ 上記のコマンドはターミナルにコピー&ペーストできます。',
    footerHintBefore: '置き換えてください —',
    footerHintAfter: 'をあなたの実際のGitHubリポジトリURLに。',
    osPickerTitle: '💻 使用するOSを選択してください',
    osPickerHint: '選択したOS向けのコマンドが生成されます',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: '自動検出',
    osForLabel: '用',
    fixErrorToggle: '🐛 エラーが出ましたか？',
    fixErrorTitle: 'AIエラーヘルパー',
    fixErrorPlaceholder: 'エラー出力をここに貼り付けてください...',
    fixErrorButton: '🤖 AIで修正',
    fixErrorAnalyzing: 'AIがエラーを分析中...',
    fixErrorProblem: '問題',
    fixErrorSolution: '解決策',
    fixErrorExplanation: '理由',
    fixErrorCommandsLabel: '推奨コマンド',
    fixErrorClose: '閉じる',
    fixErrorFailed: 'エラーを分析できませんでした。',
    fixAttemptLabel: '試行',
    fixAttemptDidNotWork: '失敗',
    fixAttemptTriedLabel: '試した',
    fixBtnDidNotWork: '❌ 失敗 — 再試行',
    fixBtnWorked: '✓ 成功 — 閉じる',
    fixMaxAttemptsReached: '⚠️ 最大試行回数(5)に達しました。',
    fixNewErrorPlaceholder: '上記の修正を試した後の新しいエラーを貼り付けてください...',
    fixPreviousAttempts: '以前の試行',
    gitActivityTitle: '🌿 Gitアクティビティ',
    gitActivitySubtitle: 'リンクされたリポジトリの最近のコミット',
    gitRefreshBtn: '🔄 更新',
    gitViewOnGithub: 'GitHubですべて表示 ↗',
    gitEmptyNoRepo: 'リポジトリURLが設定されていません',
    gitEmptyNoRepoHint: 'コミット履歴を表示するにはGitHubリポジトリをリンクしてください',
    gitSetRepoBtn: '🔗 GitHubリポジトリをリンク',
    gitRepoUrlLabel: 'リポジトリURL',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHubトークン (オプション、プライベートリポジトリ用)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: '"repo"スコープのパーソナルアクセストークンを github.com/settings/tokens で生成',
    gitSaveRepo: '保存',
    gitCancelRepo: 'キャンセル',
    gitLoadingCommits: 'コミットを読み込み中...',
    gitErrorRepoNotFound: 'リポジトリが見つかりません。URLを確認してください。',
    gitErrorRateLimited: 'レート制限です。GitHubトークンを追加してください。',
    gitErrorInvalidToken: 'GitHubトークンが無効または期限切れです。',
    gitErrorFetchFailed: 'コミットの取得に失敗しました',
    gitCommitCount: 'コミット',
    gitJustNow: 'たった今',
    gitMinutesAgo: '分前',
    gitHoursAgo: '時間前',
    gitDaysAgo: '日前',
  },

  vi: {
    tabLabel: '🚀 Cài đặt',
    cardTitle: '🚀 Hướng dẫn Cài đặt Dự án',
    cardSubtitle: 'Các lệnh do AI tạo để scaffold dự án này tại local',
    btnGenerate: '🤖 Tạo bằng AI',
    btnRegenerate: '🤖 Tạo lại',
    btnGenerating: 'Đang tạo...',
    badgeGenerated: '✓ Đã tạo',
    prereqTitle: 'ℹ️ ĐIỀU KIỆN TIÊN QUYẾT (PM)',
    prereqLine1: 'Trước khi dùng tính năng này — PM phải',
    prereqLine1Bold: 'tạo repo GitHub trống và cấp quyền cho thành viên',
    prereqLine2: 'AI sẽ tạo lệnh scaffold + git push.',
    loadingGuide: 'Đang tải hướng dẫn...',
    emptyTitle: 'Chưa có hướng dẫn cài đặt',
    emptyDescBefore: 'Nhấn',
    emptyDescAction: 'Tạo bằng AI',
    emptyDescAfter: 'ở trên để tạo hướng dẫn cài đặt.',
    emptyNoTech: '⚠️ Thêm tech stack trước',
    generatingTitle: 'AI đang phân tích dự án...',
    generatingDesc: 'Đang tạo lệnh cài đặt',
    stackDetected: '📦 STACK ĐÃ PHÁT HIỆN',
    copyBtn: '📋 Sao chép',
    copiedBtn: '✓ Đã sao chép',
    footerNote: '✨ Các lệnh trên sẵn sàng để copy-paste vào terminal.',
    footerHintBefore: 'Thay thế —',
    footerHintAfter: 'bằng URL repository GitHub thực tế.',
    osPickerTitle: '💻 Chọn hệ điều hành',
    osPickerHint: 'Lệnh sẽ được tùy chỉnh cho OS của bạn',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: 'Tự động phát hiện',
    osForLabel: 'cho',
    fixErrorToggle: '🐛 Gặp lỗi?',
    fixErrorTitle: 'Trợ lý Lỗi AI',
    fixErrorPlaceholder: 'Dán output lỗi vào đây...',
    fixErrorButton: '🤖 Sửa bằng AI',
    fixErrorAnalyzing: 'AI đang phân tích lỗi...',
    fixErrorProblem: 'VẤN ĐỀ',
    fixErrorSolution: 'GIẢI PHÁP',
    fixErrorExplanation: 'TẠI SAO',
    fixErrorCommandsLabel: 'LỆNH ĐỀ XUẤT',
    fixErrorClose: 'Đóng',
    fixErrorFailed: 'Không thể phân tích lỗi.',
    fixAttemptLabel: 'Lần thử',
    fixAttemptDidNotWork: 'Không hoạt động',
    fixAttemptTriedLabel: 'Đã thử',
    fixBtnDidNotWork: '❌ Không hoạt động — thử lại',
    fixBtnWorked: '✓ Đã hoạt động — đóng',
    fixMaxAttemptsReached: '⚠️ Đã đạt số lần thử tối đa (5).',
    fixNewErrorPlaceholder: 'Dán lỗi MỚI sau khi thử cách trên...',
    fixPreviousAttempts: 'Các lần thử trước',
    gitActivityTitle: '🌿 Hoạt động Git',
    gitActivitySubtitle: 'Các commit gần đây từ repository được liên kết',
    gitRefreshBtn: '🔄 Làm mới',
    gitViewOnGithub: 'Xem tất cả trên GitHub ↗',
    gitEmptyNoRepo: 'Chưa đặt URL repository',
    gitEmptyNoRepoHint: 'Liên kết repository GitHub để xem lịch sử commit',
    gitSetRepoBtn: '🔗 Liên kết Repo GitHub',
    gitRepoUrlLabel: 'URL Repository',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHub Token (tùy chọn, cho private repo)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: 'Tạo Personal Access Token với quyền "repo" tại github.com/settings/tokens',
    gitSaveRepo: 'Lưu',
    gitCancelRepo: 'Hủy',
    gitLoadingCommits: 'Đang tải commits...',
    gitErrorRepoNotFound: 'Không tìm thấy repository. Kiểm tra URL.',
    gitErrorRateLimited: 'Bị giới hạn. Thêm GitHub token.',
    gitErrorInvalidToken: 'GitHub token không hợp lệ.',
    gitErrorFetchFailed: 'Không tải được commits',
    gitCommitCount: 'commits',
    gitJustNow: 'Vừa xong',
    gitMinutesAgo: 'phút trước',
    gitHoursAgo: 'giờ trước',
    gitDaysAgo: 'ngày trước',
  },

  ko: {
    tabLabel: '🚀 설정',
    cardTitle: '🚀 프로젝트 설정 가이드',
    cardSubtitle: 'AI가 이 프로젝트를 로컬에서 scaffold하는 명령어 생성',
    btnGenerate: '🤖 AI로 생성',
    btnRegenerate: '🤖 재생성',
    btnGenerating: '생성 중...',
    badgeGenerated: '✓ 생성됨',
    prereqTitle: 'ℹ️ 사전 요구사항 (PM 책임)',
    prereqLine1: '이 기능을 사용하기 전에 — PM은',
    prereqLine1Bold: '빈 GitHub 저장소를 만들고 멤버 권한을 부여해야 합니다',
    prereqLine2: 'AI가 scaffold + git push 명령어를 생성합니다.',
    loadingGuide: '가이드 로딩 중...',
    emptyTitle: '아직 설정 가이드가 없습니다',
    emptyDescBefore: '위의',
    emptyDescAction: 'AI로 생성',
    emptyDescAfter: '을 클릭하여 설정 가이드를 만드세요.',
    emptyNoTech: '⚠️ 먼저 tech stack을 추가하세요',
    generatingTitle: 'AI가 프로젝트를 분석 중...',
    generatingDesc: '설정 명령어 생성 중',
    stackDetected: '📦 감지된 STACK',
    copyBtn: '📋 복사',
    copiedBtn: '✓ 복사됨',
    footerNote: '✨ 위 명령어들은 터미널에 copy-paste할 준비가 되었습니다.',
    footerHintBefore: '교체하세요 —',
    footerHintAfter: '를 실제 GitHub 저장소 URL로.',
    osPickerTitle: '💻 운영체제를 선택하세요',
    osPickerHint: '선택한 OS에 맞게 명령어가 생성됩니다',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: '자동 감지',
    osForLabel: '용',
    fixErrorToggle: '🐛 오류가 발생했나요?',
    fixErrorTitle: 'AI 오류 도우미',
    fixErrorPlaceholder: '오류 출력을 여기에 붙여넣으세요...',
    fixErrorButton: '🤖 AI로 수정',
    fixErrorAnalyzing: 'AI가 오류를 분석 중...',
    fixErrorProblem: '문제',
    fixErrorSolution: '해결책',
    fixErrorExplanation: '이유',
    fixErrorCommandsLabel: '제안된 명령어',
    fixErrorClose: '닫기',
    fixErrorFailed: '오류를 분석할 수 없습니다.',
    fixAttemptLabel: '시도',
    fixAttemptDidNotWork: '실패',
    fixAttemptTriedLabel: '시도함',
    fixBtnDidNotWork: '❌ 실패 — 다시 시도',
    fixBtnWorked: '✓ 성공 — 닫기',
    fixMaxAttemptsReached: '⚠️ 최대 시도 횟수(5)에 도달했습니다.',
    fixNewErrorPlaceholder: '위의 수정을 시도한 후 나온 새로운 오류를 붙여넣으세요...',
    fixPreviousAttempts: '이전 시도',
    gitActivityTitle: '🌿 Git 활동',
    gitActivitySubtitle: '연결된 저장소의 최근 커밋',
    gitRefreshBtn: '🔄 새로고침',
    gitViewOnGithub: 'GitHub에서 모두 보기 ↗',
    gitEmptyNoRepo: '저장소 URL이 설정되지 않았습니다',
    gitEmptyNoRepoHint: '커밋 기록을 보려면 GitHub 저장소를 연결하세요',
    gitSetRepoBtn: '🔗 GitHub 저장소 연결',
    gitRepoUrlLabel: '저장소 URL',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHub 토큰 (선택, 비공개 저장소용)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: '"repo" 범위의 Personal Access Token을 github.com/settings/tokens에서 생성하세요',
    gitSaveRepo: '저장',
    gitCancelRepo: '취소',
    gitLoadingCommits: '커밋 로딩 중...',
    gitErrorRepoNotFound: '저장소를 찾을 수 없습니다. URL을 확인하세요.',
    gitErrorRateLimited: '속도 제한됨. GitHub 토큰을 추가하세요.',
    gitErrorInvalidToken: 'GitHub 토큰이 유효하지 않습니다.',
    gitErrorFetchFailed: '커밋을 가져오지 못했습니다',
    gitCommitCount: '커밋',
    gitJustNow: '방금',
    gitMinutesAgo: '분 전',
    gitHoursAgo: '시간 전',
    gitDaysAgo: '일 전',
  },

  km: {
    tabLabel: '🚀 ដំឡើង',
    cardTitle: '🚀 មគ្គុទេសក៍ដំឡើងគម្រោង',
    cardSubtitle: 'ពាក្យបញ្ជាដែលបង្កើតដោយ AI',
    btnGenerate: '🤖 បង្កើតដោយ AI',
    btnRegenerate: '🤖 បង្កើតឡើងវិញ',
    btnGenerating: 'កំពុងបង្កើត...',
    badgeGenerated: '✓ បានបង្កើត',
    prereqTitle: 'ℹ️ លក្ខខណ្ឌតម្រូវ (PM)',
    prereqLine1: 'មុនពេលប្រើ — PM ត្រូវតែ',
    prereqLine1Bold: 'បង្កើត repo GitHub ទទេ និងផ្តល់សិទ្ធិសមាជិក',
    prereqLine2: 'AI នឹងបង្កើតពាក្យបញ្ជា scaffold + git push។',
    loadingGuide: 'កំពុងផ្ទុកមគ្គុទេសក៍...',
    emptyTitle: 'មិនទាន់មានមគ្គុទេសក៍ដំឡើង',
    emptyDescBefore: 'ចុច',
    emptyDescAction: 'បង្កើតដោយ AI',
    emptyDescAfter: 'ខាងលើដើម្បីបង្កើតមគ្គុទេសក៍ដំឡើង។',
    emptyNoTech: '⚠️ បន្ថែម tech stack ជាមុន',
    generatingTitle: 'AI កំពុងវិភាគគម្រោង...',
    generatingDesc: 'កំពុងបង្កើតពាក្យបញ្ជា',
    stackDetected: '📦 STACK ដែលបានរកឃើញ',
    copyBtn: '📋 ចម្លង',
    copiedBtn: '✓ ចម្លងរួច',
    footerNote: '✨ ពាក្យបញ្ជាខាងលើត្រៀមខ្លួនសម្រាប់ copy-paste។',
    footerHintBefore: 'ជំនួស —',
    footerHintAfter: 'ដោយ URL repository GitHub ជាក់ស្តែង។',
    osPickerTitle: '💻 ជ្រើសរើសប្រព័ន្ធប្រតិបត្តិការ',
    osPickerHint: 'ពាក្យបញ្ជានឹងត្រូវបានសម្រួលសម្រាប់ OS របស់អ្នក',
    osMacos: '🍎 macOS',
    osWindows: '🪟 Windows',
    osLinux: '🐧 Linux',
    osAutoDetected: 'រកឃើញដោយស្វ័យប្រវត្តិ',
    osForLabel: 'សម្រាប់',
    fixErrorToggle: '🐛 មានបញ្ហា?',
    fixErrorTitle: 'ជំនួយការបញ្ហា AI',
    fixErrorPlaceholder: 'បិទភ្ជាប់ output បញ្ហារបស់អ្នកនៅទីនេះ...',
    fixErrorButton: '🤖 ជួសជុលដោយ AI',
    fixErrorAnalyzing: 'AI កំពុងវិភាគបញ្ហា...',
    fixErrorProblem: 'បញ្ហា',
    fixErrorSolution: 'ដំណោះស្រាយ',
    fixErrorExplanation: 'ហេតុអ្វី',
    fixErrorCommandsLabel: 'ពាក្យបញ្ជាណែនាំ',
    fixErrorClose: 'បិទ',
    fixErrorFailed: 'មិនអាចវិភាគបញ្ហាបានទេ។',
    fixAttemptLabel: 'ការព្យាយាម',
    fixAttemptDidNotWork: 'មិនដំណើរការ',
    fixAttemptTriedLabel: 'បានព្យាយាម',
    fixBtnDidNotWork: '❌ មិនដំណើរការ — ព្យាយាមម្តងទៀត',
    fixBtnWorked: '✓ ដំណើរការ — បិទ',
    fixMaxAttemptsReached: '⚠️ ឈានដល់ចំនួនព្យាយាមអតិបរមា (5)។',
    fixNewErrorPlaceholder: 'បិទភ្ជាប់បញ្ហាថ្មីបន្ទាប់ពីព្យាយាមខាងលើ...',
    fixPreviousAttempts: 'ការព្យាយាមមុន',
    gitActivityTitle: '🌿 សកម្មភាព Git',
    gitActivitySubtitle: 'Commits ថ្មីៗពី repository ដែលបានភ្ជាប់',
    gitRefreshBtn: '🔄 ផ្ទុកឡើងវិញ',
    gitViewOnGithub: 'មើលទាំងអស់នៅលើ GitHub ↗',
    gitEmptyNoRepo: 'URL Repository មិនទាន់បានកំណត់',
    gitEmptyNoRepoHint: 'ភ្ជាប់ GitHub repository ដើម្បីឃើញប្រវត្តិ commit',
    gitSetRepoBtn: '🔗 ភ្ជាប់ GitHub Repo',
    gitRepoUrlLabel: 'URL Repository',
    gitRepoUrlPlaceholder: 'https://github.com/owner/repo',
    gitTokenLabel: 'GitHub Token (ស្រេចចិត្ត សម្រាប់ private repo)',
    gitTokenPlaceholder: 'ghp_xxxxxxxxxxxxxxxxxxxx',
    gitTokenHint: 'បង្កើត Personal Access Token ជាមួយ scope "repo" នៅ github.com/settings/tokens',
    gitSaveRepo: 'រក្សាទុក',
    gitCancelRepo: 'បោះបង់',
    gitLoadingCommits: 'កំពុងផ្ទុក commits...',
    gitErrorRepoNotFound: 'រកមិនឃើញ repository។ ពិនិត្យ URL។',
    gitErrorRateLimited: 'Rate limit។ បន្ថែម GitHub token។',
    gitErrorInvalidToken: 'GitHub token មិនត្រឹមត្រូវ។',
    gitErrorFetchFailed: 'មិនអាចទាញយក commits',
    gitCommitCount: 'commits',
    gitJustNow: 'ទើបតែ',
    gitMinutesAgo: 'នាទីមុន',
    gitHoursAgo: 'ម៉ោងមុន',
    gitDaysAgo: 'ថ្ងៃមុន',
  },
};

export function setupLabel(lang: string | undefined | null, key: SetupI18nKey): string {
  const safeLang = (lang && (lang in SETUP_I18N)) ? (lang as SetupI18nLang) : 'en';
  const dict = SETUP_I18N[safeLang] || SETUP_I18N.en;
  return dict[key] || SETUP_I18N.en[key] || key;
}

export type ProjectOS = 'macos' | 'windows' | 'linux';

export function detectOS(): ProjectOS {
  if (typeof navigator === 'undefined') return 'macos';
  const platform = (navigator.platform || '').toLowerCase();
  const userAgent = (navigator.userAgent || '').toLowerCase();
  if (platform.includes('mac') || userAgent.includes('mac os')) return 'macos';
  if (platform.includes('win') || userAgent.includes('windows')) return 'windows';
  if (platform.includes('linux') || userAgent.includes('linux')) return 'linux';
  return 'macos';
}

export function osLabel(lang: string | undefined | null, os: ProjectOS): string {
  switch (os) {
    case 'windows': return setupLabel(lang, 'osWindows');
    case 'linux':   return setupLabel(lang, 'osLinux');
    default:        return setupLabel(lang, 'osMacos');
  }
}

export interface SetupErrorFix {
  problem:     string;
  solution:    string;
  commands:    string[];
  explanation: string;
}

export interface FixAttempt {
  suggestedSolution: string;
  triedCommands:     string;
  newError:          string;
  timestamp:         number;
}

// ── Git Commit types (NEW) ──
export interface GitCommit {
  sha:            string;
  shortSha:       string;
  htmlUrl:        string;
  message:        string;
  fullMessage?:   string;
  authorName?:    string;
  authorEmail?:   string;
  date?:          string;
  githubLogin?:   string;
  avatarUrl?:     string;
  githubProfile?: string;
}

export interface GitCommitsResponse {
  owner?:   string;
  repo?:    string;
  repoUrl?: string;
  commits:  GitCommit[];
  count?:   number;
  error?:   string;
  message?: string;
}

/** Format a relative time like "2 hrs ago" from an ISO date string */
export function formatRelativeTime(
  lang: string | undefined | null,
  isoDate: string | undefined | null
): string {
  if (!isoDate) return '';
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr  = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1)  return setupLabel(lang, 'gitJustNow');
  if (diffMin < 60) return `${diffMin} ${setupLabel(lang, 'gitMinutesAgo')}`;
  if (diffHr  < 24) return `${diffHr} ${setupLabel(lang, 'gitHoursAgo')}`;
  if (diffDay < 30) return `${diffDay} ${setupLabel(lang, 'gitDaysAgo')}`;

  return date.toLocaleDateString();
}