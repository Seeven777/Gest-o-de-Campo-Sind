import { LayoutDashboard, Building2, CalendarDays, Route, ClipboardCheck, CheckCheck, Receipt, Map, Users, ChartNoAxesCombined, FileUp, Settings, Camera, Navigation, Wallet, UserRound, Trash2, RadioTower } from 'lucide-react';
export const adminMenu = [
 {label:'Visão geral',href:'/dashboard',icon:LayoutDashboard,group:'principal'},
 {label:'Empresas',href:'/empresas',icon:Building2,group:'principal'},
 {label:'Cadastros sindicais',href:'/cadastros',icon:ClipboardCheck,group:'principal'},
 {label:'Rotas',href:'/rotas',icon:Route,group:'principal'},
 {label:'Visitas',href:'/visitas',icon:ClipboardCheck,group:'operacao'},
 {label:'Validações',href:'/validacoes',icon:CheckCheck,group:'operacao'},
 {label:'Reembolsos',href:'/reembolsos',icon:Receipt,group:'sistema'},
 {label:'Mapa de cobertura',href:'/mapa',icon:Map,group:'inteligencia'},
 {label:'Localização da equipe',href:'/localizacoes',icon:RadioTower,group:'sistema'},
 {label:'Equipes',href:'/equipes',icon:Users,group:'inteligencia'},
 {label:'Relatórios',href:'/relatorios',icon:ChartNoAxesCombined,group:'inteligencia'},
 {label:'Importações',href:'/importacoes',icon:FileUp,group:'sistema'},
 {label:'Configurações',href:'/configuracoes',icon:Settings,group:'sistema'},
 {label:'Limpeza de testes',href:'/limpeza',icon:Trash2,group:'sistema'},
];
export const rhMenu = [
 {label:'Conferir reembolsos',href:'/reembolsos',icon:Receipt,group:'principal'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
export const cadastroMenu = [
 {label:'Conferir cadastros',href:'/cadastros',icon:ClipboardCheck,group:'principal'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
export const agentMenu = [
 {label:'Meu dia',href:'/agente',icon:CalendarDays,group:'principal'},
 {label:'Minha jornada',href:'/rotas',icon:Navigation,group:'principal'},
 {label:'Minhas visitas',href:'/visitas',icon:Camera,group:'principal'},
 {label:'Minhas despesas',href:'/reembolsos',icon:Wallet,group:'sistema'},
 {label:'Meus resultados',href:'/relatorios',icon:ChartNoAxesCombined,group:'principal'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
