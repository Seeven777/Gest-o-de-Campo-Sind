import { LayoutDashboard, Building2, CalendarDays, Route, ClipboardList, CheckCheck, Receipt, Map, Users, FileBarChart, FileUp, Settings, UserRound, Camera, Wallet, Navigation, BarChart3 } from 'lucide-react';
export const adminMenu=[
 {label:'Dashboard',href:'/dashboard',icon:LayoutDashboard},
 {label:'Empresas',href:'/empresas',icon:Building2},
 {label:'Campanhas',href:'/campanhas',icon:CalendarDays},
 {label:'Rotas',href:'/rotas',icon:Route},
 {label:'Visitas',href:'/visitas',icon:ClipboardList},
 {label:'Validações',href:'/validacoes',icon:CheckCheck},
 {label:'Reembolsos',href:'/reembolsos',icon:Receipt},
 {label:'Mapa territorial',href:'/mapa',icon:Map},
 {label:'Equipes',href:'/equipes',icon:Users},
 {label:'Relatórios',href:'/relatorios',icon:FileBarChart},
 {label:'Importações',href:'/importacoes',icon:FileUp},
 {label:'Configurações',href:'/configuracoes',icon:Settings}
];
export const agentMenu=[{label:'Minha agenda',href:'/agente',icon:CalendarDays},{label:'Minha rota',href:'/rotas',icon:Navigation},{label:'Registrar visita',href:'/visitas',icon:Camera},{label:'Minhas despesas',href:'/reembolsos',icon:Wallet},{label:'Meus resultados',href:'/relatorios',icon:BarChart3},{label:'Meu perfil',href:'/configuracoes',icon:UserRound}];
