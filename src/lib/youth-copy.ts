import type { Lang } from './schema';

/** Copy for the youth features. Machine-language pages fall back to English (they carry the machine notice). */
const COPY = {
  en: {
    storiesLabel: 'IN 60 SECONDS',
    storiesTitle: 'Mann Ki Baat in 60 seconds',
    storiesHint: 'Swipe through the big topics',
    prev: 'Previous',
    next: 'Next',
    readMore: 'Read more',
    share: 'Share',
    shareTitle: 'Share this as an image',
    forYouLabel: "WHAT'S IN IT FOR YOU",
    forYouTitle: 'Pick who you are',
    forYouHint: 'See the topics and official links that matter to you.',
    forYouNone: 'Nothing this month for this group — try another.',
    youthLabel: 'YOUTH SPOTLIGHT',
    youthTitle: 'For young India',
    quizLabel: 'QUICK QUIZ',
    quizTitle: 'How well did you listen?',
    quizCheck: 'Check answers',
    quizScore: (n: number, of: number) => `You got ${n} of ${of} right.`,
    quizBest: (n: number, of: number) => `Your best: ${n} of ${of}`,
    quizSource: 'From the official transcript, paragraph',
    correct: 'Correct',
    wrong: 'Not quite',
    askLabel: 'ASK ABOUT THIS EPISODE',
    askTitle: 'What did he say about…',
    askPlaceholder: 'Try: millets, start-ups, Khadi',
    askSearch: 'Search the transcript',
    askHint: 'Searches the official transcript and shows the exact words.',
    askNone: 'No matching paragraph. Try another word.',
    askPara: 'Paragraph',
    askLoading: 'Loading…',
    shareFooter: 'Independent explainer · Source: pmindia.gov.in',
  },
  hi: {
    storiesLabel: '60 सेकंड में',
    storiesTitle: '60 सेकंड में मन की बात',
    storiesHint: 'मुख्य विषयों को स्वाइप करके देखें',
    prev: 'पिछला',
    next: 'अगला',
    readMore: 'और पढ़ें',
    share: 'शेयर करें',
    shareTitle: 'इसे चित्र के रूप में शेयर करें',
    forYouLabel: 'आपके लिए क्या है',
    forYouTitle: 'चुनें कि आप कौन हैं',
    forYouHint: 'आपके काम के विषय और आधिकारिक लिंक देखें।',
    forYouNone: 'इस महीने इस समूह के लिए कुछ नहीं — दूसरा चुनें।',
    youthLabel: 'युवा विशेष',
    youthTitle: 'युवा भारत के लिए',
    quizLabel: 'छोटी प्रश्नोत्तरी',
    quizTitle: 'आपने कितना ध्यान से सुना?',
    quizCheck: 'उत्तर जाँचें',
    quizScore: (n: number, of: number) => `आपके ${of} में से ${n} सही हैं।`,
    quizBest: (n: number, of: number) => `आपका सर्वश्रेष्ठ: ${of} में से ${n}`,
    quizSource: 'आधिकारिक पाठ से, अनुच्छेद',
    correct: 'सही',
    wrong: 'सही नहीं',
    askLabel: 'इस एपिसोड के बारे में पूछें',
    askTitle: 'उन्होंने किस बारे में क्या कहा…',
    askPlaceholder: 'जैसे: मोटा अनाज, स्टार्टअप, खादी',
    askSearch: 'आधिकारिक पाठ में खोजें',
    askHint: 'आधिकारिक पाठ में खोजकर ठीक वही शब्द दिखाता है।',
    askNone: 'कोई अनुच्छेद नहीं मिला। दूसरा शब्द आज़माएँ।',
    askPara: 'अनुच्छेद',
    askLoading: 'लोड हो रहा है…',
    shareFooter: 'स्वतंत्र व्याख्या · स्रोत: pmindia.gov.in',
  },
};

export type YouthCopy = (typeof COPY)['en'];
export const youthCopy = (lang: Lang): YouthCopy => (lang === 'hi' ? COPY.hi : COPY.en);

/** First sentence of a text (used when a topic has no explicit takeaway). */
export function firstSentence(s: string): string {
  const m = s.match(/^.*?[.!?।](\s|$)/u);
  return (m ? m[0] : s).trim();
}
