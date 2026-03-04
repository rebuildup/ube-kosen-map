import type React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  color?: string;
}

export const Icon: React.FC<IconProps & { children?: React.ReactNode }> = ({
  children,
  className = "",
  color = "currentColor",
  size = 24,
  ...rest
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...rest}
  >
    <title>Icon</title>
    {children}
  </svg>
);

// Re-export lucide icons with the project's previous names so existing imports keep working.

export {
  AlertTriangle as AlertIcon,
  Bookmark as BookmarkIcon,
  Calendar as ScheduleIcon,
  Clock as TimeIcon,
  Home as HomeIcon,
  Image as ExhibitIcon,
  Info as InfoIcon,
  Map as MapIcon,
  MapPin as LocationIcon,
  Menu as MenuIcon,
  Moon as MoonIcon,
  Ribbon as SponsorIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  Speaker as EventIcon,
  Sun as SunIcon,
  Trash2 as TrashIcon,
  Users as PeopleIcon,
  UtensilsCrossed as StallIcon,
  X as XIcon,
} from "lucide-react";
export { ENIcon, JPIcon } from "./LanguageIcon";
