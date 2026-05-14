import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/recipes")({
  component: RecipesPage,
});

type Recipe = {
  id: string;
  category: string;
  product: string;
  recipe: string;
  sort_order: number;
};

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, category, product, recipe, sort_order")
        .order("sort_order", { ascending: true });
      if (error) {
        toast.error(error.message);
      } else {
        setRecipes(data ?? []);
      }
      setLoading(false);
    })();
  }, []);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? recipes.filter(
          (r) =>
            r.product.toLowerCase().includes(q) ||
            r.category.toLowerCase().includes(q) ||
            r.recipe.toLowerCase().includes(q),
        )
      : recipes;
    const map = new Map<string, Recipe[]>();
    for (const r of filtered) {
      const key = r.category || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.entries());
  }, [recipes, query]);

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-3xl md:text-4xl">Recipes</h1>
        <p className="text-muted-foreground mt-1">
          Drink recipes for front-of-house staff.
        </p>
      </header>

      <div className="mb-6">
        <Input
          placeholder="Search by name, category, or ingredient..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <p className="text-muted-foreground">No recipes match.</p>
      ) : (
        <div className="space-y-8">
          {grouped.map(([category, items]) => (
            <section key={category}>
              <h2 className="text-lg mb-3 sticky top-0 bg-background py-2 z-10 border-b border-border">
                {category}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((r) => (
                  <Card key={r.id}>
                    <CardHeader>
                      <CardTitle>{r.product}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed">
                        {r.recipe}
                      </pre>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
