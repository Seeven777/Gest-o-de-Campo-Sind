import type {Role} from '@/lib/access';
export type Capability='overview.read'|'companies.read'|'campaigns.read'|'campaigns.write'|'routes.read'|'routes.write'|'routes.publish'|'visits.read'|'visits.write'|'reviews.manage'|'expenses.own'|'expenses.manage'|'territory.read'|'reports.read'|'users.manage'|'registrations.manage'|'imports.manage'|'locations.read';
const grants:Record<Role,readonly Capability[]>={
 admin:['overview.read','companies.read','campaigns.read','campaigns.write','routes.read','routes.write','routes.publish','visits.read','reviews.manage','expenses.own','expenses.manage','territory.read','reports.read','users.manage','registrations.manage','imports.manage','locations.read'],
 supervisor:['overview.read','companies.read','campaigns.read','campaigns.write','routes.read','routes.write','routes.publish','visits.read','reviews.manage','expenses.own','expenses.manage','territory.read','reports.read','locations.read'],
 marketing:['overview.read','companies.read','campaigns.read','routes.read','routes.publish','territory.read','reports.read'],
 agent:['companies.read','routes.read','visits.read','visits.write','expenses.own','reports.read']
};
export const can=(role:Role,capability:Capability)=>grants[role]?.includes(capability)??false;
