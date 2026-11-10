-- SindPetshop-SP: limpeza controlada de registros de teste.
-- Executar manualmente no Neon SQL Editor, após backup.
-- Esta migração APENAS CRIA a função. Não exclui registros ao ser executada.
CREATE OR REPLACE FUNCTION admin_delete_test_record(p_kind text,p_id uuid,p_actor text)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_count integer:=0;v_name text;
BEGIN
 IF p_kind='route' THEN
  SELECT c.name INTO v_name FROM routes r JOIN campaigns c ON c.id=r.campaign_id WHERE r.id=p_id FOR UPDATE OF r;
  IF v_name IS NULL OR v_name NOT ILIKE '%teste%' THEN RAISE EXCEPTION 'Apenas rotas de campanhas identificadas como teste podem ser excluídas.'; END IF;
  DELETE FROM visit_evidence WHERE visit_id IN (SELECT v.id FROM visits v JOIN route_stops s ON s.id=v.stop_id WHERE s.route_id=p_id);
  DELETE FROM visits WHERE stop_id IN (SELECT id FROM route_stops WHERE route_id=p_id);
  DELETE FROM route_stops WHERE route_id=p_id;
  DELETE FROM routes WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
 ELSIF p_kind='visit' THEN
  SELECT c.name INTO v_name FROM visits v JOIN route_stops s ON s.id=v.stop_id JOIN routes r ON r.id=s.route_id JOIN campaigns c ON c.id=r.campaign_id WHERE v.id=p_id FOR UPDATE OF v;
  IF v_name IS NULL OR v_name NOT ILIKE '%teste%' THEN RAISE EXCEPTION 'Apenas visitas vinculadas a campanha de teste podem ser excluídas.'; END IF;
  DELETE FROM visit_evidence WHERE visit_id=p_id;
  DELETE FROM visits WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
 ELSIF p_kind='expense' THEN
  SELECT c.name INTO v_name FROM expenses e JOIN campaigns c ON c.id=e.campaign_id WHERE e.id=p_id AND e.approval_status NOT IN ('paid') FOR UPDATE OF e;
  IF v_name IS NULL OR v_name NOT ILIKE '%teste%' THEN RAISE EXCEPTION 'Somente despesa de teste não paga pode ser excluída.'; END IF;
  DELETE FROM expenses WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
 ELSIF p_kind='campaign' THEN
  SELECT name INTO v_name FROM campaigns WHERE id=p_id FOR UPDATE;
  IF v_name IS NULL OR v_name NOT ILIKE '%teste%' THEN RAISE EXCEPTION 'Somente campanhas com teste no nome podem ser excluídas.'; END IF;
  IF EXISTS(SELECT 1 FROM routes WHERE campaign_id=p_id) OR EXISTS(SELECT 1 FROM expenses WHERE campaign_id=p_id) THEN
   RAISE EXCEPTION 'Exclua primeiro rotas e despesas vinculadas à campanha.';
  END IF;
  DELETE FROM campaigns WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
 ELSIF p_kind='company' THEN
  IF NOT EXISTS(SELECT 1 FROM establishments WHERE id=p_id FOR UPDATE) THEN RAISE EXCEPTION 'Empresa não encontrada.'; END IF;
  IF EXISTS(SELECT 1 FROM route_stops WHERE establishment_id=p_id) THEN RAISE EXCEPTION 'Empresa vinculada a rota: exclua a rota de teste primeiro.'; END IF;
  IF EXISTS(SELECT 1 FROM registration_records WHERE establishment_id=p_id AND state='confirmed') THEN RAISE EXCEPTION 'Cadastro sindical confirmado: exclusão proibida.'; END IF;
  DELETE FROM registration_records WHERE establishment_id=p_id AND state IN ('pending','rejected');
  DELETE FROM establishments WHERE id=p_id;
  GET DIAGNOSTICS v_count=ROW_COUNT;
 ELSE RAISE EXCEPTION 'Tipo de registro inválido.';
 END IF;
 INSERT INTO audit_logs(actor_id,action,details) VALUES(p_actor,'admin.test_cleanup',jsonb_build_object('type',p_kind,'id',p_id,'deleted',v_count));
 RETURN v_count;
END $$;
