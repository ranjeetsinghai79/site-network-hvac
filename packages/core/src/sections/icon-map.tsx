import {
  Thermometer, Flame, Droplets, Zap, ShieldCheck, Wrench,
  Star, Heart, Scissors, Sparkles, Clock, Hammer, Truck,
  Home, Briefcase, Phone, Award, DollarSign, ThumbsUp,
  Building2, Trees, Sun, Bath, Bed, Maximize2, Car,
  Stethoscope, Smile, Scale, Gavel, Brush, Trash2,
  Baby, Coffee, Pizza, Utensils, Wine, ChefHat,
} from "lucide-react"

export const ICON_MAP: Record<string, React.ReactNode> = {
  thermometer:    <Thermometer />,
  flame:          <Flame />,
  droplets:       <Droplets />,
  zap:            <Zap />,
  "shield-check": <ShieldCheck />,
  wrench:         <Wrench />,
  star:           <Star />,
  heart:          <Heart />,
  scissors:       <Scissors />,
  sparkles:       <Sparkles />,
  clock:          <Clock />,
  hammer:         <Hammer />,
  truck:          <Truck />,
  home:           <Home />,
  briefcase:      <Briefcase />,
  phone:          <Phone />,
  award:          <Award />,
  "dollar-sign":  <DollarSign />,
  "thumbs-up":    <ThumbsUp />,
  building:       <Building2 />,
  trees:          <Trees />,
  sun:            <Sun />,
  bath:           <Bath />,
  bed:            <Bed />,
  maximize:       <Maximize2 />,
  car:            <Car />,
  stethoscope:    <Stethoscope />,
  smile:          <Smile />,
  scale:          <Scale />,
  gavel:          <Gavel />,
  brush:          <Brush />,
  trash:          <Trash2 />,
  baby:           <Baby />,
  coffee:         <Coffee />,
  pizza:          <Pizza />,
  utensils:       <Utensils />,
  wine:           <Wine />,
  "chef-hat":     <ChefHat />,
}

export function getIcon(name: string, className = "w-7 h-7"): React.ReactNode {
  const icon = ICON_MAP[name]
  if (!icon) return <Wrench className={className} />
  // Clone with className
  return <span className={`inline-flex ${className}`}>{icon}</span>
}
