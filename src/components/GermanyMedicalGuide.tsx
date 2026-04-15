import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GraduationCap, DollarSign, FileText, MapPin, AlertCircle, CheckCircle } from "lucide-react";

const allUniversities = [
  { rank: 1, name: "جامعة هايدلبرغ", city: "هايدلبرغ", state: "بادن-فورتمبيرغ", tuition: 1500, semester: 161, globalRank: 53 },
  { rank: 2, name: "جامعة لودفيغ ماكسيميليان ميونخ", city: "ميونخ", state: "بافاريا", tuition: 0, semester: 85, globalRank: 54 },
  { rank: 3, name: "جامعة ميونخ التقنية", city: "ميونخ", state: "بافاريا", tuition: 0, semester: 85, globalRank: 100 },
  { rank: 4, name: "جامعة توبنغن", city: "توبنغن", state: "بادن-فورتمبيرغ", tuition: 1500, semester: 200, globalRank: 105 },
  { rank: 5, name: "جامعة إرلنغن-نورنبيرغ", city: "إرلنغن", state: "بافاريا", tuition: 0, semester: 72, globalRank: 106 },
  { rank: 6, name: "جامعة هامبورغ", city: "هامبورغ", state: "هامبورغ", tuition: 0, semester: 343, globalRank: 116 },
  { rank: 7, name: "جامعة بون", city: "بون", state: "شمال الراين-وستفاليا", tuition: 0, semester: 313, globalRank: 117 },
  { rank: 8, name: "كلية هانوفر الطبية", city: "هانوفر", state: "سكسونيا السفلى", tuition: 0, semester: 360, globalRank: 127 },
  { rank: 9, name: "جامعة فرايبورغ", city: "فرايبورغ", state: "بادن-فورتمبيرغ", tuition: 1500, semester: 190, globalRank: 136 },
  { rank: 10, name: "جامعة مونستر", city: "مونستر", state: "شمال الراين-وستفاليا", tuition: 0, semester: 317, globalRank: 141 },
  { rank: 11, name: "جامعة غوته فرانكفورت", city: "فرانكفورت", state: "هسن", tuition: 0, semester: 340, globalRank: 146 },
  { rank: 12, name: "جامعة أولم", city: "أولم", state: "بادن-فورتمبيرغ", tuition: 1500, semester: 182, globalRank: 151 },
  { rank: 13, name: "جامعة لايبزيغ", city: "لايبزيغ", state: "ساكسونيا", tuition: 0, semester: 250, globalRank: 152 },
  { rank: 14, name: "جامعة دويسبورغ-إيسن", city: "دويسبورغ/إيسن", state: "شمال الراين-وستفاليا", tuition: 0, semester: 319, globalRank: 156 },
  { rank: 15, name: "جامعة هاينريش هاينه دوسلدورف", city: "دوسلدورف", state: "شمال الراين-وستفاليا", tuition: 0, semester: 300, globalRank: 166 },
  { rank: 16, name: "جامعة كيل", city: "كيل", state: "شليسفيغ-هولشتاين", tuition: 0, semester: 302, globalRank: 168 },
  { rank: 17, name: "جامعة كولونيا", city: "كولونيا", state: "شمال الراين-وستفاليا", tuition: 0, semester: 336, globalRank: 181 },
  { rank: 18, name: "جامعة غوتينغن", city: "غوتينغن", state: "سكسونيا السفلى", tuition: 0, semester: 390, globalRank: 187 },
  { rank: 19, name: "جامعة يوهانس غوتنبرغ ماينتس", city: "ماينتس", state: "راينلاند-بفالز", tuition: 0, semester: 350, globalRank: 188 },
  { rank: 20, name: "جامعة فورتسبورغ", city: "فورتسبورغ", state: "بافاريا", tuition: 0, semester: 155, globalRank: 200 },
  { rank: 21, name: "جامعة لوبيك", city: "لوبيك", state: "شليسفيغ-هولشتاين", tuition: 0, semester: 300, globalRank: 201 },
  { rank: 22, name: "جامعة دريسدن التقنية", city: "دريسدن", state: "ساكسونيا", tuition: 0, semester: 300, globalRank: 204 },
  { rank: 23, name: "جامعة آخن", city: "آخن", state: "شمال الراين-وستفاليا", tuition: 0, semester: 304, globalRank: 214 },
  { rank: 24, name: "جامعة غيسن", city: "غيسن", state: "هسن", tuition: 0, semester: 335, globalRank: 217 },
  { rank: 25, name: "جامعة ريغنسبورغ", city: "ريغنسبورغ", state: "بافاريا", tuition: 0, semester: 180, globalRank: 222 },
  { rank: 26, name: "جامعة فيليبس ماربورغ", city: "ماربورغ", state: "هسن", tuition: 0, semester: 449, globalRank: 243 },
  { rank: 27, name: "جامعة سارلاند", city: "ساربروكن", state: "سارلاند", tuition: 0, semester: 300, globalRank: 259 },
  { rank: 28, name: "جامعة الرور في بوخوم", city: "بوخوم", state: "شمال الراين-وستفاليا", tuition: 0, semester: 350, globalRank: 268 },
  { rank: 29, name: "جامعة فريدريش شيلر يينا", city: "يينا", state: "تورينغن", tuition: 0, semester: 305, globalRank: 333 },
  { rank: 30, name: "جامعة أوتو فون غريكه ماغدبورغ", city: "ماغدبورغ", state: "ساكسونيا-أنهالت", tuition: 0, semester: 311, globalRank: 359 },
];

export default function GermanyMedicalGuide() {
  return (
    <div className="space-y-12 py-8">
      {/* Hero Section */}
      <section className="text-center space-y-4">
        <h2 className="text-3xl md:text-4xl font-bold">
          دليل شامل لأفضل 30 جامعة طبية في ألمانيا 2025
        </h2>
        <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
          كل ما تحتاج معرفته عن دراسة الطب في ألمانيا - البرامج، الرسوم، متطلبات القبول، والمزيد
        </p>
      </section>

      {/* Introduction */}
      <section className="space-y-6">
        <Card className="border-l-4 border-l-primary">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-6 h-6 text-primary" />
              المكانة العالمية للجامعات الطبية الألمانية
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-muted-foreground leading-relaxed">
            <p>
              يحظى التعليم الطبي في ألمانيا بتقدير عالمي كبير، حيث تتمتع جامعاتها بسمعة مرموقة في مجالات البحث العلمي والممارسة السريرية. 
              إن الحصول على شهادة في الطب من ألمانيا يُعد إنجازًا معترفًا به دوليًا، مما يفتح آفاقًا مهنية واسعة للخريجين.
            </p>
            <p>
              يعتمد نظام التعليم الطبي الألماني بشكل أساسي على المستشفيات الجامعية (Universitätskliniken)، مثل مستشفى شاريتيه في برلين 
              والمستشفى الجامعي في ميونخ، التي تلعب دورًا محوريًا في التدريب العملي للطلاب.
            </p>
          </CardContent>
        </Card>

        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-900 dark:text-amber-100">
              <AlertCircle className="w-6 h-6" />
              ملاحظة هامة حول لغة التدريس
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-amber-800 dark:text-amber-200">
            <p className="font-semibold">
              برامج الطب البشري، طب الأسنان، والصيدلة التي تنتهي بامتحان الدولة (Staatsexamen) تُدرّس حصريًا باللغة الألمانية في جميع الجامعات الحكومية.
            </p>
            <p>
              يجب على الطلاب الدوليين إثبات إتقانهم للغة الألمانية بمستوى متقدم، عادة C1 وفقًا للإطار الأوروبي المرجعي.
            </p>
            <p className="text-sm">
              على النقيض، تتوفر برامج ماجستير في مجالات ذات صلة (الصحة العامة، الهندسة الطبية الحيوية) تُدرّس بالكامل باللغة الإنجليزية.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Financial Framework */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <DollarSign className="w-8 h-8 text-primary" />
          الإطار المالي لدراسة الطب في ألمانيا
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                مبدأ التعليم المجاني
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                الجامعات الحكومية في ألمانيا ممولة من الدولة، ولا تفرض رسومًا دراسية على معظم برامجها، بما في ذلك للطلاب الدوليين.
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-5 h-5" />
                استثناءات هامة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <strong>ولاية بادن-فورتمبيرغ:</strong>
                <p className="text-muted-foreground mt-1">رسوم 1,500 يورو/فصل (3,000 يورو/سنة) للطلاب من خارج الاتحاد الأوروبي</p>
              </div>
              <div>
                <strong>مساهمة الفصل الدراسي (Semesterbeitrag):</strong>
                <p className="text-muted-foreground mt-1">100-400 يورو/فصل تشمل تذكرة نقل عام</p>
              </div>
              <div>
                <strong>تكاليف المعيشة:</strong>
                <p className="text-muted-foreground mt-1">850-1,200 يورو/شهر + حساب مغلق 11,904 يورو للتأشيرة</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>مقارنة التكلفة السنوية</CardTitle>
            <CardDescription>للطالب من خارج الاتحاد الأوروبي</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-2">السيناريو</th>
                    <th className="text-right py-2">الرسوم السنوية</th>
                    <th className="text-right py-2">مساهمة الفصل</th>
                    <th className="text-right py-2">المعيشة</th>
                    <th className="text-right py-2 font-bold">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2">جامعة قياسية</td>
                    <td className="py-2">0 €</td>
                    <td className="py-2">650 €</td>
                    <td className="py-2">11,904 €</td>
                    <td className="py-2 font-bold">12,554 €</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">بادن-فورتمبيرغ</td>
                    <td className="py-2">3,000 €</td>
                    <td className="py-2">380 €</td>
                    <td className="py-2">11,904 €</td>
                    <td className="py-2 font-bold">15,284 €</td>
                  </tr>
                  <tr>
                    <td className="py-2">جامعة خاصة</td>
                    <td className="py-2">34,800 €</td>
                    <td className="py-2">-</td>
                    <td className="py-2">11,904 €</td>
                    <td className="py-2 font-bold">46,704 €</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Admission Requirements */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="w-8 h-8 text-primary" />
          متطلبات وإجراءات القبول
        </h3>

        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Numerus Clausus (NC)</CardTitle>
              <CardDescription>نظام القبول المحدود</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>يتطلب معدلاً شبه مثالي (1.0-1.3 في النظام الألماني)</p>
              <Badge variant="destructive" className="text-xs">5% فقط للطلاب الدوليين</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">متطلبات اللغة</CardTitle>
              <CardDescription>مستوى C1 إلزامي</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>TestDaF</span>
                <Badge variant="secondary">TDN 4</Badge>
              </div>
              <div className="flex justify-between">
                <span>DSH</span>
                <Badge variant="secondary">DSH-2/3</Badge>
              </div>
              <div className="flex justify-between">
                <span>Goethe</span>
                <Badge variant="secondary">C2: GDS</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Studienkolleg</CardTitle>
              <CardDescription>السنة التحضيرية</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>إلزامي لمن لا تعادل شهادتهم Abitur</p>
              <p>دورة M-Kurs لمدة عام</p>
              <p>امتحان FSP في النهاية</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* All 30 Universities */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold flex items-center gap-2">
          <GraduationCap className="w-8 h-8 text-primary" />
          أفضل 30 جامعة طبية في ألمانيا
        </h3>

        <div className="grid md:grid-cols-2 gap-6">
          {allUniversities.map((uni) => (
            <Card key={uni.rank} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <Badge className="mb-2">#{uni.rank} وطنياً | #{uni.globalRank} عالمياً</Badge>
                    <CardTitle className="text-lg">{uni.name}</CardTitle>
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="w-4 h-4" />
                      {uni.city}, {uni.state}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">رسوم دراسية/فصل</p>
                    <p className="font-bold text-primary">
                      {uni.tuition === 0 ? "مجاناً" : `${uni.tuition} €`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">مساهمة الفصل</p>
                    <p className="font-semibold">{uni.semester} €</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Strategic Pathways */}
      <section className="space-y-6">
        <h3 className="text-2xl font-bold">المسارات الاستراتيجية للطلاب الدوليين</h3>

        <Tabs defaultValue="path1" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="path1">المسار المباشر</TabsTrigger>
            <TabsTrigger value="path2">السنة التحضيرية</TabsTrigger>
            <TabsTrigger value="path3">الماجستير بالإنجليزية</TabsTrigger>
          </TabsList>

          <TabsContent value="path1" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>المسار المباشر باللغة الألمانية</CardTitle>
                <CardDescription>للطلاب المتفوقين أكاديمياً بمستوى C1</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">المميزات:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>أسرع طريق لتصبح طبيبًا (6 سنوات و 3 أشهر)</li>
                    <li>القبول مباشرة في البرنامج</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">المتطلبات:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>معدل شبه مثالي</li>
                    <li>لغة ألمانية C1</li>
                    <li>شهادة معادلة لـ Abitur</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="path2" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>طريق Studienkolleg (السنة التحضيرية)</CardTitle>
                <CardDescription>للطلاب بمستوى B1/B2 أو شهادة غير معادلة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">المميزات:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>مسار منظم لتلبية متطلبات القبول</li>
                    <li>تحسين اللغة في سياق أكاديمي</li>
                    <li>فرصة لتحسين المعدل</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">العيوب:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>يضيف عامًا إضافيًا للدراسة</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="path3" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>طريق الماجستير باللغة الإنجليزية</CardTitle>
                <CardDescription>للحاصلين على بكالوريوس ذي صلة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">المميزات:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>الدراسة بدون إتقان الألمانية C1</li>
                    <li>تخصصات علمية مطلوبة (الصحة العامة، الهندسة الطبية)</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">ملاحظة مهمة:</h4>
                  <p className="text-sm text-destructive">
                    لا يؤدي إلى ترخيص لممارسة الطب - مسار علمي وليس سريري
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>

      {/* Application Checklist */}
      <section>
        <Card className="border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>قائمة مرجعية للتقديم</CardTitle>
            <CardDescription>الخطوات التالية القابلة للتنفيذ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { icon: CheckCircle, text: "تقييم الملف الأكاديمي: تحقق من مطابقة درجاتك لمعايير NC العالية" },
                { icon: CheckCircle, text: "التحقق من معادلة الشهادة: استخدم مواقع DAAD أو uni-assist" },
                { icon: CheckCircle, text: "الالتزام بتعلم اللغة: ابدأ دورات ألمانية مكثفة للوصول لـ C1" },
                { icon: CheckCircle, text: "التخطيط المالي: جهز 11,904 يورو للحساب المغلق" },
                { icon: CheckCircle, text: "متابعة المواعيد: 15 يوليو للفصل الشتوي، 15 يناير للفصل الصيفي" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 text-sm">
                  <item.icon className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
