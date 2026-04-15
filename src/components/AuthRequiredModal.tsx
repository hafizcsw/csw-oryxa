import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Heart, UserPlus, LogIn, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface AuthRequiredModalProps {
  onClose: () => void;
}

export function AuthRequiredModal({ onClose }: AuthRequiredModalProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] sm:max-w-md border-2 border-primary/20">
        <DialogHeader>
          <div className="mx-auto mb-3 sm:mb-4 p-3 sm:p-4 bg-gradient-to-br from-red-500/10 to-primary/10 rounded-full w-fit">
            <Heart className="w-8 h-8 sm:w-12 sm:h-12 text-red-500 fill-red-500" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {t("authModal.reachedLimit")}
          </DialogTitle>
          <DialogDescription className="pt-3 sm:pt-4 text-center space-y-2 sm:space-y-3">
            <p className="text-sm sm:text-base text-foreground font-medium">
              {t("authModal.selected")} <span className="font-bold text-primary">5/5 {t("authModal.universities")}</span> {t("authModal.maxLimit")}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {t("authModal.registerNow")}
            </p>
            <div className="pt-2 px-3 sm:px-4 py-2 sm:py-3 bg-muted/50 rounded-lg border border-border/50">
              <p className="text-xs sm:text-sm text-muted-foreground">
                💡 <span className="font-semibold">{t("authModal.tip")}</span> {t("authModal.tipText")}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2 sm:gap-3">
          <Button
            className="w-full h-10 sm:h-11 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white font-bold shadow-lg text-sm"
            onClick={() => {
              onClose();
              navigate("/auth?mode=signup");
            }}
          >
            <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {t("authModal.createAccount")}
          </Button>
          <Button
            variant="outline"
            className="w-full h-10 sm:h-11 border-2 hover:border-primary hover:bg-primary/5 text-sm"
            onClick={() => {
              onClose();
              navigate("/auth?mode=login");
            }}
          >
            <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            {t("authModal.haveAccount")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="w-full text-muted-foreground hover:text-foreground text-xs sm:text-sm"
            onClick={onClose}
          >
            <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
            {t("authModal.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
