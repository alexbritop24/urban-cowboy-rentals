-- Production retained the August seed values because the September price
-- migrations were missed. Reconcile only those known legacy values with the
-- already-published $280 daily prices. Preserve subsequent custom prices and
-- every saved request, Agreement, and Invoice snapshot.
update private.rental_equipment_catalog catalog
set daily_rate = 280,
    rate_options = (
      select jsonb_agg(
        case when rate->>'label' = '1 Day'
          then jsonb_set(rate, '{price}', '280'::jsonb)
          else rate end order by position
      )
      from jsonb_array_elements(catalog.rate_options) with ordinality entries(rate, position)
    ),
    updated_at = now()
from (values
  ('bobcat-t550-skid-steer', 120::numeric),
  ('bobcat-e35r2-compact-excavator', 275::numeric)
) legacy(equipment_id, daily_rate)
where catalog.equipment_id = legacy.equipment_id
  and catalog.daily_rate = legacy.daily_rate
  and catalog.rate_options->0->>'label' = '1 Day'
  and (catalog.rate_options->0->>'price')::numeric = legacy.daily_rate;
