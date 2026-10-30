-- Optional demo data. Run this AFTER you have signed up at least one user
-- through the app (so a row exists in auth.users / public.farmers), then
-- replace the farmer_id below with that user's id (Authentication -> Users
-- in the Supabase dashboard).

do $$
declare
  v_farmer_id uuid := '00000000-0000-0000-0000-000000000000'; -- <-- replace me
  v_field_id  uuid;
  v_anomaly_id uuid;
  v_cause_id  uuid;
  d date;
begin
  insert into public.fields (farmer_id, field_name, boundary_coords, crop_type, area_hectares)
  values (v_farmer_id, 'Field A - Maize',
          '{"type":"Polygon","coordinates":[[[32.60,0.35],[32.61,0.35],[32.61,0.36],[32.60,0.36],[32.60,0.35]]]}',
          'Maize', 2.1)
  returning id into v_field_id;

  -- 30 days of NDVI history with a dip in the last week
  for i in 0..29 loop
    d := current_date - (29 - i);
    insert into public.satellite_images (field_id, capture_date, ndvi_value, cloud_cover_pct)
    values (
      v_field_id, d,
      case when i > 23 then 0.42 - (i - 23) * 0.02 else 0.60 + random() * 0.05 end,
      random() * 10
    );
    insert into public.weather_records (field_id, record_date, rainfall_mm, temperature_c, humidity_pct)
    values (v_field_id, d, case when i > 23 then 1.5 else 8 + random() * 6 end, 27, 58);
  end loop;

  insert into public.anomalies (field_id, date_detected, ndvi_drop_pct, severity, status)
  values (v_field_id, current_date - 2, 18, 'moderate', 'open')
  returning id into v_anomaly_id;

  insert into public.inferred_causes (anomaly_id, cause_type, confidence_pct)
  values (v_anomaly_id, 'drought', 82)
  returning id into v_cause_id;

  insert into public.recommendations (cause_id, solution_text)
  values (v_cause_id, 'Rainfall has stayed below average for two weeks. Consider irrigation if available for this field.');

  insert into public.alerts (anomaly_id, message_text, viewed_flag)
  values (v_anomaly_id, 'Possible drought stress: NDVI dropped 18% over 10 days and rainfall has stayed below average for two weeks. Consider irrigation if available for this field.', false);
end $$;
