import { LayoutDashboard, Building2, CalendarDays, Route, ClipboardCheck, CheckCheck, Receipt, Map, Users, ChartNoAxesCombined, FileUp, Settings, Camera, Navigation, Wallet, UserRound } from 'lucide-react';
export const adminMenu = [
 {label:'Visão geral',href:'/dashboard',icon:LayoutDashboard,group:'principal'},
 {label:'Empresas',href:'/empresas',icon:Building2,group:'principal'},
 {label:'Campanhas',href:'/campanhas',icon:CalendarDays,group:'principal'},
 {label:'Rotas',href:'/rotas',icon:Route,group:'principal'},
 {label:'Visitas',href:'/visitas',icon:ClipboardCheck,group:'operacao'},
 {label:'Validações',href:'/validacoes',icon:CheckCheck,group:'operacao'},
 {label:'Reembolsos',href:'/reembolsos',icon:Receipt,group:'operacao'},
 {label:'Mapa de cobertura',href:'/mapa',icon:Map,group:'inteligencia'},
 {label:'Equipes',href:'/equipes',icon:Users,group:'inteligencia'},
 {label:'Relatórios',href:'/relatorios',icon:ChartNoAxesCombined,group:'inteligencia'},
 {label:'Importações',href:'/importacoes',icon:FileUp,group:'sistema'},
 {label:'Configurações',href:'/configuracoes',icon:Settings,group:'sistema'},
];
export const agentMenu = [
 {label:'Meu dia',href:'/agente',icon:CalendarDays,group:'principal'},
 {label:'Minha rota',href:'/rotas',icon:Navigation,group:'principal'},
 {label:'Registrar visita',href:'/visitas',icon:Camera,group:'principal'},
 {label:'Minhas despesas',href:'/reembolsos',icon:Wallet,group:'principal'},
 {label:'Meus resultados',href:'/relatorios',icon:ChartNoAxesCombined,group:'principal'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
