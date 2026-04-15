import { Calendar, Plus, Clock, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface Appointment {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'meeting' | 'reminder' | 'deadline';
}

interface AppointmentsSectionProps {
  appointments?: Appointment[];
}

export function AppointmentsSection({ appointments = [] }: AppointmentsSectionProps) {
  return (
    <div className="bg-card rounded-2xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          المواعيد والتذكارات
        </h3>
        <Button variant="outline" size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">إضافة موعد</span>
        </Button>
      </div>

      {appointments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">لا توجد مواعيد قادمة</p>
          <p className="text-xs mt-1">سيظهر هنا أي مواعيد أو تذكارات مجدولة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((appointment, index) => (
            <motion.div
              key={appointment.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`p-4 rounded-xl border ${
                appointment.type === 'deadline'
                  ? 'bg-red-500/10 border-red-500/30'
                  : appointment.type === 'meeting'
                  ? 'bg-blue-500/10 border-blue-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className={`w-4 h-4 ${
                    appointment.type === 'deadline'
                      ? 'text-red-500'
                      : appointment.type === 'meeting'
                      ? 'text-blue-500'
                      : 'text-amber-500'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{appointment.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(appointment.date).toLocaleDateString('ar-SA', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                      {appointment.time && ` - ${appointment.time}`}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
