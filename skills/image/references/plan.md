# The plan

One message, in Hebrew, before anything is built or paid. The user reads it in half a minute.

```
**התוכנית לתמונה** (<פורמט>, <גודל>)

**מה היא אומרת:** <משפט אחד>

**השכבות, מאחור לפנים:**
1. <שכבה>: <מה היא, מאיפה היא מגיעה: המקור שלך, נוצרת ב AI, נחתכת, נכתבת בקוד>
2. ...

**כל המילים שיופיעו על התמונה:** <רשימה, באיות המדויק>
**מה נשאר בדיוק כמו שהוא:** <הפוסטר המקורי, הלוגו, הצילומים>
**גדלים:** <פוסט, סטורי, ריבוע>
**השירות:** <the name of the MCP connection, alone, or nothing when there is no paid step>
**עלות:** <השלבים בתשלום ומחירם בדולרים או בקרדיטים, כפי שהספק סופר, או "בלי עלות">

מאשרים, או שיש מה לשנות?
```

- Every word on the picture is listed with its exact spelling. Numbers, dates and prices come from the user.
- The price comes from the provider's tool (`references/generate.md`), not from memory. A paid step runs only
  after the yes to the plan that names it.
- When there are two directions (a photo wall or a single scene; a stamp or a ribbon), show both in one line each
  and recommend one.
- After the yes, write the plan as `plan.md` in the project folder.

## Example

**התוכנית לתמונה** (פוסט לאינסטגרם, 1080 על 1440)

**מה היא אומרת:** הסדנה בטכניון מלאה.

**השכבות, מאחור לפנים:**
1. הפוסטר המקורי שלך, כמו שהוא.
2. סרט אדום עם SOLD OUT, נוצר ב AI על עותק של הפוסטר ונחתך ממנו, מונח על המקור עם צל.

**כל המילים שיופיעו על התמונה:** SOLD OUT (על הסרט, באנגלית כמו במקור).
**מה נשאר בדיוק כמו שהוא:** כל הפוסטר, הלוגואים והשותפים.
**גדלים:** פוסט. סטורי אם תרצה, בלי עלות.
**השירות:** fal
**עלות:** שני ניסיונות של הסרט, 0.30 דולר, וחיתוך, 0.01 דולר. סך הכול 0.31 דולר.

מאשרים, או שיש מה לשנות?
