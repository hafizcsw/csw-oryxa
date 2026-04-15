import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, GripVertical, User, Mail, Phone, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent, 
  PointerSensor, 
  useSensor, 
  useSensors,
  useDroppable,
  useDraggable
} from '@dnd-kit/core';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Student {
  user_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  student_substage: string;
  student_progress: number;
  created_at: string;
}

interface Column {
  id: string;
  title: string;
  color: string;
}

const COLUMNS: Column[] = [
  { id: 'collecting_docs', title: 'جمع المستندات', color: 'bg-blue-500' },
  { id: 'docs_review', title: 'مراجعة المستندات', color: 'bg-yellow-500' },
  { id: 'docs_approved', title: 'المستندات معتمدة', color: 'bg-green-500' },
  { id: 'payment_pending', title: 'دفعة مطلوبة', color: 'bg-orange-500' },
  { id: 'partially_paid', title: 'دفعة جزئية', color: 'bg-amber-500' },
  { id: 'fully_paid', title: 'مدفوع بالكامل', color: 'bg-emerald-500' },
  { id: 'ready_to_submit', title: 'جاهز للتقديم', color: 'bg-indigo-500' },
  { id: 'submitted', title: 'تم التقديم', color: 'bg-purple-500' },
  { id: 'offer_received', title: 'وصول العرض', color: 'bg-pink-500' },
  { id: 'offer_accepted', title: 'قبول العرض', color: 'bg-teal-500' },
];

export default function CRMBoard() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<Student[]>([]);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  useEffect(() => {
    loadStudents();
    
    // Setup realtime subscription
    const channel = supabase
      .channel('crm-board-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          loadStudents();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadStudents = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, phone, student_substage, student_progress, created_at')
        .not('student_substage', 'is', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStudents(data || []);
    } catch (error) {
      console.error('Load students error:', error);
      toast({
        title: 'خطأ',
        description: 'فشل تحميل البيانات',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const student = students.find(s => s.user_id === event.active.id);
    setActiveStudent(student || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStudent(null);

    if (!over || active.id === over.id) return;

    const studentId = active.id as string;
    const newStage = over.id as string;
    
    const student = students.find(s => s.user_id === studentId);
    if (!student) return;

    // Optimistic update
    setStudents(prev =>
      prev.map(s =>
        s.user_id === studentId
          ? { ...s, student_substage: newStage }
          : s
      )
    );

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ student_substage: newStage })
        .eq('user_id', studentId);

      if (error) throw error;

      toast({
        title: 'تم التحديث',
        description: `تم نقل ${student.full_name} إلى ${COLUMNS.find(c => c.id === newStage)?.title}`,
      });
    } catch (error) {
      console.error('Update stage error:', error);
      // Revert optimistic update
      loadStudents();
      toast({
        title: 'خطأ',
        description: 'فشل تحديث المرحلة',
        variant: 'destructive',
      });
    }
  };

  const getStudentsByStage = (stageId: string) => {
    return students.filter(s => s.student_substage === stageId);
  };

  if (loading) {
    return (
      <div className="container py-12 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">لوحة إدارة الطلاب</h1>
        <p className="text-muted-foreground">
          اسحب وأفلت بطاقات الطلاب بين الأعمدة لتحديث حالتهم
        </p>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(column => {
            const columnStudents = getStudentsByStage(column.id);
            
            return (
              <DroppableColumn
                key={column.id}
                column={column}
                students={columnStudents}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeStudent ? <StudentCardOverlay student={activeStudent} /> : null}
        </DragOverlay>
      </DndContext>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h3 className="font-semibold mb-2">ملاحظات:</h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• عند نقل الطالب إلى مرحلة جديدة، سيتم تحديث شريط التقدم تلقائياً</li>
          <li>• سيرى الطالب التحديث فوراً في بوابته الشخصية</li>
          <li>• التحديثات تحدث في الوقت الفعلي لجميع المسؤولين</li>
        </ul>
      </div>
    </div>
  );
}

// Droppable Column Component
function DroppableColumn({ column, students }: { column: Column; students: Student[] }) {
  const { setNodeRef } = useDroppable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      className="flex-shrink-0 w-80"
    >
      <Card className="h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${column.color}`} />
              {column.title}
            </CardTitle>
            <Badge variant="secondary">{students.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 min-h-[400px]">
          {students.map(student => (
            <DraggableStudentCard key={student.user_id} student={student} />
          ))}
          {students.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              لا يوجد طلاب في هذه المرحلة
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Draggable Student Card
function DraggableStudentCard({ student }: { student: Student }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: student.user_id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 bg-card border rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-move ${
        isDragging ? 'opacity-50' : ''
      }`}
      {...listeners}
      {...attributes}
    >
      <StudentCardContent student={student} />
    </div>
  );
}

// Student Card Content
function StudentCardContent({ student }: { student: Student }) {
  return (
    <>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{student.full_name}</span>
        </div>
        <GripVertical className="w-4 h-4 text-muted-foreground" />
      </div>
      
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Mail className="w-3 h-3" />
          <span className="truncate">{student.email}</span>
        </div>
        {student.phone && (
          <div className="flex items-center gap-2">
            <Phone className="w-3 h-3" />
            <span>{student.phone}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3" />
          <span>{format(new Date(student.created_at), 'dd MMM yyyy', { locale: ar })}</span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">التقدم</span>
          <span className="font-semibold">{student.student_progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-secondary rounded-full mt-1 overflow-hidden">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${student.student_progress}%` }}
          />
        </div>
      </div>
    </>
  );
}

// Drag Overlay Card
function StudentCardOverlay({ student }: { student: Student }) {
  return (
    <div className="p-3 bg-card border rounded-lg shadow-lg w-72">
      <StudentCardContent student={student} />
    </div>
  );
}

