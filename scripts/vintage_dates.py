"""Conservative conversion of source dating strings to broad filter envelopes.

Century modifiers (early/late/half/quarter) are intentionally not turned into
invented exact years. Original strings remain in the public records.
"""
import re


def date_envelope(text):
    text = str(text).upper().replace('BCE', 'BC').replace('CE', 'AD')
    text = re.sub(r'(?<=\d)(ST|ND|RD|TH)(?=BC|AD)', r'\1 ', text)
    text = re.sub(r'\b(BC|AD)(?=\d)', r'\1 ', text)
    eras = re.findall(r'\bBC\b|\bAD\b', text)
    if not eras:
        return None
    centuries = list(re.finditer(r'(\d{1,2})(?:ST|ND|RD|TH)\b', text))
    spans = []
    if centuries:
        for i, match in enumerate(centuries):
            n = int(match[1])
            if not 1 <= n <= 30:
                return None
            following = text[match.end():]
            era_match = re.search(r'\bBC\b|\bAD\b', following)
            era = era_match[0] if era_match else eras[-1]
            spans.append((-100*n, -(100*(n-1)+1)) if era == 'BC' else (100*(n-1)+1, 100*n))
        # "C1st BC-AD" crosses the era boundary without repeating the century.
        if len(centuries) == 1 and set(eras) == {'BC', 'AD'}:
            n = int(centuries[0][1])
            spans.extend([(-100*n, -1), (1, 100*n)])
    else:
        # Only accept explicit numeric year/range syntax, not unparsed prose.
        match = re.fullmatch(r'\s*AD\s+(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*', text)
        if not match:
            return None
        a, b = int(match[1]), int(match[2] or match[1])
        if a == 0 or b == 0:
            return None
        spans.append((min(a,b), max(a,b)))
    return min(s[0] for s in spans), max(s[1] for s in spans)
