// Hindi papers set in Kruti Dev, an old font that draws Hindi letters in place of Latin ones: the PDF's text says
// "Hkkjr" where the page shows भारत. This turns that text into real (Unicode) Hindi with the font's letter table,
// then puts two things where Unicode wants them: the vowel sign ि, which Kruti Dev types before its consonant, and
// the र् written above a letter (reph), which it types after the syllable. Pure, no app dependencies.

/** Kruti Dev 010's letters, in the order they must be replaced: longer sequences before their parts. */
const TABLE: [string, string][] = [
    ['ñ', '॰'], ['Q+Z', 'QZ+'], ['sas', 'sa'], ['aa', 'a'], [')Z', 'र्द्ध'], ['ZZ', 'Z'],
    ['‘', '"'], ['’', '"'], ['“', "'"], ['”', "'"],
    ['å', '०'], ['ƒ', '१'], ['„', '२'], ['…', '३'], ['†', '४'], ['‡', '५'], ['ˆ', '६'], ['‰', '७'], ['Š', '८'], ['‹', '९'],
    ['¶+', 'फ़्'], ['d+', 'क़'], ['[+k', 'ख़'], ['[+', 'ख़्'], ['x+', 'ग़'], ['T+', 'ज़्'], ['t+', 'ज़'], ['M+', 'ड़'], ['<+', 'ढ़'],
    ['Q+', 'फ़'], [';+', 'य़'], ['j+', 'ऱ'], ['u+', 'ऩ'],
    ['Ùk', 'त्त'], ['Ù', 'त्त्'], ['Dr', 'क्त'], ['–', 'दृ'], ['—', 'कृ'], ['é', 'न्न'], ['™', 'न्न्'], ['=kk', '=k'], ['f=k', 'f='],
    ['à', 'ह्न'], ['á', 'ह्य'], ['â', 'हृ'], ['ã', 'ह्म'], ['ºz', 'ह्र'], ['º', 'ह्'], ['í', 'द्द'], ['{k', 'क्ष'], ['{', 'क्ष्'],
    ['=', 'त्र'], ['«', 'त्र्'], ['Nî', 'छ्य'], ['Vî', 'ट्य'], ['Bî', 'ठ्य'], ['Mî', 'ड्य'], ['<î', 'ढ्य'], ['|', 'द्य'], ['K', 'ज्ञ'],
    ['}', 'द्व'], ['J', 'श्र'], ['Vª', 'ट्र'], ['Mª', 'ड्र'], ['<ªª', 'ढ्र'], ['Nª', 'छ्र'], ['Ø', 'क्र'], ['Ý', 'फ्र'], ['nzZ', 'र्द्र'],
    ['æ', 'द्र'], ['ç', 'प्र'], ['Á', 'प्र'], ['xz', 'ग्र'], ['#', 'रु'], [':', 'रू'],
    ['v‚', 'ऑ'], ['vks', 'ओ'], ['vkS', 'औ'], ['vk', 'आ'], ['v', 'अ'], ['b±', 'ईं'], ['Ã', 'ई'], ['bZ', 'ई'], ['b', 'इ'], ['m', 'उ'],
    ['Å', 'ऊ'], [',s', 'ऐ'], [',', 'ए'], ['_', 'ऋ'],
    ['ô', 'क्क'], ['d', 'क'], ['Dk', 'क'], ['D', 'क्'], ['[k', 'ख'], ['[', 'ख्'], ['x', 'ग'], ['Xk', 'ग'], ['X', 'ग्'], ['Ä', 'घ'],
    ['?k', 'घ'], ['?', 'घ्'], ['³', 'ङ'], ['pkS', 'चै'], ['p', 'च'], ['Pk', 'च'], ['P', 'च्'], ['N', 'छ'], ['t', 'ज'], ['Tk', 'ज'],
    ['T', 'ज्'], ['>', 'झ'], ['÷', 'झ्'], ['¥', 'ञ'], ['ê', 'ट्ट'], ['ë', 'ट्ठ'], ['V', 'ट'], ['B', 'ठ'], ['ì', 'ड्ड'], ['ï', 'ड्ढ'],
    ['M', 'ड'], ['<', 'ढ'], ['.k', 'ण'], ['.', 'ण्'], ['r', 'त'], ['Rk', 'त'], ['R', 'त्'], ['Fk', 'थ'], ['F', 'थ्'], [')', 'द्ध'],
    ['n', 'द'], ['/k', 'ध'], ['èk', 'ध'], ['/', 'ध्'], ['è', 'ध्'], ['u', 'न'], ['Uk', 'न'], ['U', 'न्'], ['i', 'प'], ['Ik', 'प'],
    ['I', 'प्'], ['Q', 'फ'], ['¶', 'फ्'], ['c', 'ब'], ['Ck', 'ब'], ['C', 'ब्'], ['Hk', 'भ'], ['H', 'भ्'], ['e', 'म'], ['Ek', 'म'],
    ['E', 'म्'], [';', 'य'], ['¸', 'य्'], ['j', 'र'], ['y', 'ल'], ['Yk', 'ल'], ['Y', 'ल्'], ['G', 'ळ'], ['o', 'व'], ['Ok', 'व'],
    ['O', 'व्'], ["'k", 'श'], ["'", 'श्'], ['"k', 'ष'], ['"', 'ष्'], ['l', 'स'], ['Lk', 'स'], ['L', 'स्'], ['g', 'ह'],
    ['È', 'ीं'], ['z', '्र'], ['Ì', 'द्द'], ['Í', 'ट्ट'], ['Î', 'ट्ठ'], ['Ï', 'ड्ड'], ['Ñ', 'कृ'], ['Ò', 'भ'], ['Ó', '्य'], ['Ô', 'ड्ढ'],
    ['Ö', 'झ्'], ['Ú', 'फ्र'], ['Ü', 'श्'], ['‚', 'ॉ'], ['ks', 'ो'], ['kS', 'ौ'], ['k', 'ा'], ['h', 'ी'], ['q', 'ु'], ['w', 'ू'],
    ['`', 'ृ'], ['s', 'े'], ['S', 'ै'], ['a', 'ं'], ['¡', 'ँ'], ['%', 'ः'], ['W', 'ॅ'], ['•', 'ऽ'], ['·', 'ऽ'], ['∙', 'ऽ'], ['~', '्'],
    ['+', '़'], ['\\', '?'], ['^', '‘'], ['*', '’'], ['Þ', '“'], ['ß', '”'], ['±', 'Zं'], ['f', 'ि'],
    // Punctuation Kruti Dev keeps on other keys, last, after the letters that share them.
    ['A', '।'], [']', ','], ['@', '/'], ['-', '.'], ['&', '-'], ['¼', '('], ['½', ')'], ['¿', '{'], ['À', '}'], ['¾', '='],
]

const CONSONANT = '[\\u0915-\\u0939\\u0958-\\u095F]'
/** A consonant cluster: half consonants (consonant + ्), then a full one, each perhaps with a nukta (़). */
const CLUSTER = `(?:${CONSONANT}\\u093C?\\u094D)*${CONSONANT}\\u093C?`
const I_BEFORE = new RegExp(`\\u093F(${CLUSTER})`, 'g')
/** Vowel signs and marks that follow a consonant: the reph goes before the consonant, past these. */
const SIGNS = /[ा-ौँ-ः़]/

export function krutiToUnicode(text: string): string {
    let out = text
    for (const [from, to] of TABLE) {
        out = out.split(from).join(to)
    }
    // ि typed before its consonant (cluster): after it.
    out = out.replace(I_BEFORE, '$1ि')
    // The reph (Z) typed after its syllable: र् before the syllable's consonant cluster, past its vowel signs.
    for (let at = out.indexOf('Z'); at !== -1; at = out.indexOf('Z')) {
        let i = at - 1
        while (i >= 0 && SIGNS.test(out[i])) {
            i--
        }
        // The consonant, and the half consonants joined before it.
        while (i >= 1 && out[i - 1] === '्') {
            i -= 2
        }
        const start = Math.max(0, i)
        out = `${out.slice(0, start)}र्${out.slice(start, at)}${out.slice(at + 1)}`
    }
    return out
}

/** Whether text reads as Hindi: its common short words (है, के, की, में, से, और…) make up a fair share of it. Text
 *  converted with the wrong font's table doesn't. */
export function looksLikeHindi(text: string): boolean {
    const words = text.split(/[\s।,.;:!?"'()]+/).filter(Boolean)
    if (words.length < 40) {
        return false
    }
    const common = new Set(['है', 'हैं', 'के', 'की', 'का', 'में', 'से', 'और', 'को', 'ने', 'पर', 'भी', 'यह', 'एक', 'कि', 'था', 'थी', 'लिए', 'साथ', 'नहीं'])
    return words.filter((w) => common.has(w)).length / words.length > 0.08
}
