DROP VIEW IF EXISTS public.menu_display_view;

CREATE VIEW public.menu_display_view AS
SELECT
  s.id AS section_id,
  s.name AS section_name,
  s.description AS section_description,
  s.display_order AS section_order,
  s.visible_menus AS section_visible_menus,
  s.is_hidden AS section_is_hidden,
  s.sold_out_date AS section_sold_out_date,
  ss.id AS subsection_id,
  ss.name AS subsection_name,
  ss.description AS subsection_description,
  ss.display_order AS subsection_order,
  ss.visible_menus AS subsection_visible_menus,
  ss.is_hidden AS subsection_is_hidden,
  ss.sold_out_date AS subsection_sold_out_date,
  mi.id AS item_id,
  mi.title AS item_title,
  mi.description AS item_description,
  mi.base_price_cents,
  mi.display_order AS item_order,
  mi.is_hidden AS item_is_hidden,
  mi.sold_out_date AS item_sold_out_date,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'name', m.modification_name,
        'price_modifier_cents', m.price_modifier_cents,
        'order', m.display_order
      ) ORDER BY m.display_order
    )
    FROM item_modifications m
    WHERE m.item_id = mi.id AND m.is_deleted = false
  ), '[]'::jsonb) AS modifications
FROM menu_sections s
LEFT JOIN menu_subsections ss
  ON ss.section_id = s.id
 AND ss.is_deleted = false
 AND ss.is_hidden = false
LEFT JOIN menu_items mi
  ON mi.subsection_id = ss.id
 AND mi.is_deleted = false
 AND mi.is_hidden = false
WHERE s.is_deleted = false
  AND s.is_hidden = false
ORDER BY s.display_order, ss.display_order, mi.display_order;