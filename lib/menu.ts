import {LayoutDashboard,Building2,CalendarDays,Route,ClipboardCheck,CheckCheck,Receipt,Map,Users,ChartNoAxesCombined,FileUp,Settings,Camera,Navigation,Wallet,UserRound,RadioTower} from 'lucide-react';

/** Agrupamento por trabalho, não por módulos técnicos. As rotas permanecem independentes. */
export const adminMenu=[
 {label:'Visão geral',href:'/dashboard',icon:LayoutDashboard,group:'principal'},
 {label:'Rotas',href:'/rotas',icon:Route,group:'campo'},
 {label:'Visitas',href:'/visitas',icon:ClipboardCheck,group:'campo'},
 {label:'Validações',href:'/validacoes',icon:CheckCheck,group:'campo'},
 {label:'Empresas',href:'/empresas',icon:Building2,group:'captacao'},
 {label:'Cadastros sindicais',href:'/cadastros',icon:ClipboardCheck,group:'captacao'},
 {label:'Mapa de cobertura',href:'/mapa',icon:Map,group:'captacao'},
 {label:'Indicadores',href:'/relatorios',icon:ChartNoAxesCombined,group:'captacao'},
 {label:'Pessoas e acessos',href:'/equipes',icon:Users,group:'gestao'},
 {label:'Reembolsos',href:'/reembolsos',icon:Receipt,group:'gestao'},
 {label:'Localização da equipe',href:'/localizacoes',icon:RadioTower,group:'gestao'},
 {label:'Importar empresas',href:'/importacoes',icon:FileUp,group:'gestao'},
 {label:'Configurações',href:'/configuracoes',icon:Settings,group:'sistema'},
];
export const rhMenu=[
 {label:'Reembolsos',href:'/reembolsos',icon:Receipt,group:'gestao'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
export const cadastroMenu=[
 {label:'Área de Cadastro',href:'/cadastros',icon:ClipboardCheck,group:'captacao'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
export const agentMenu=[
 {label:'Meu dia',href:'/agente',icon:CalendarDays,group:'principal'},
 {label:'Minhas rotas',href:'/rotas',icon:Navigation,group:'campo'},
 {label:'Minhas visitas',href:'/visitas',icon:Camera,group:'campo'},
 {label:'Minhas despesas',href:'/reembolsos',icon:Wallet,group:'gestao'},
 {label:'Meus resultados',href:'/relatorios',icon:ChartNoAxesCombined,group:'captacao'},
 {label:'Meu perfil',href:'/configuracoes',icon:UserRound,group:'sistema'},
];
