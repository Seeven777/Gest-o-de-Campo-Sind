import {defineConfig,globalIgnores} from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

export default defineConfig([
 ...nextVitals,
 ...nextTs,
 // Código legado chama funções assíncronas a partir de efeitos; manter o aviso
 // sem impedir testes e a implantação gradual do fluxo guiado.
 {rules:{'react-hooks/set-state-in-effect':'warn'}},
 globalIgnores(['.next/**','out/**','build/**','next-env.d.ts']),
]);
