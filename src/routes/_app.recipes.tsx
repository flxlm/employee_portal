import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/recipes")({
  component: RecipesPage,
});

type Recipe = {
  id: string;
  category: string;
  product: string;
  recipe: string;
  dish_used: string;
  special_instructions: string;
  sort_order: number;
};

function parseSteps(recipe: string): string[] {
  if (!recipe) return [];
  // Split by newlines first; if single line, split by sentence-like delimiters or numbered markers
  const byLine = recipe
    .split(/\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byLine.length > 1) return byLine.map(stripLeader);

  // Try to detect numbered "1. ... 2. ..." within one line
  const numbered = recipe.split(/(?:^|\s)(?=\d+[.)]\s)/).map((s) => s.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered.map(stripLeader);

  // Fallback: split by sentence ending punctuation (. ; •)
  const bySentence = recipe
    .split(/(?<=[.;•])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (bySentence.length > 1) return bySentence.map(stripLeader);

  return [recipe.trim()];
}

function stripLeader(s: string): string {
  return s.replace(/^\s*(?:\d+[.)]\s*|[-•]\s*)/, "").trim();
}

function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [selected, setSelected] = useState<Recipe | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("recipes")
        .select("id, category, product, recipe, dish_used, special_instructions, sort_order")
        .order("sort_order", { ascending: true });
      if (error) {
        toast.error(error.message);
      } else {
        setRecipes((data ?? []) as Recipe[]);
      }
      setLoading(false);
    })();
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(recipes.map((r) => r.category).filter(Boolean))),
    [recipes],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (category !== "all" && r.category !== category) return false;
      if (!q) return true;
      return (
        r.product.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        r.recipe.toLowerCase().includes(q) ||
        (r.dish_used ?? "").toLowerCase().includes(q)
      );
    });
  }, [recipes, query, category]);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl">Recipes</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} recipes</p>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, ingredient..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-secondary-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Product</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Dish used</th>
                  <th className="text-right px-4 py-3 font-medium">Steps</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const steps = parseSteps(r.recipe);
                  return (
                    <tr
                      key={r.id}
                      className="border-t border-border hover:bg-muted/40 cursor-pointer"
                      onClick={() => setSelected(r)}
                    >
                      <td className="px-4 py-3 font-medium">{r.product}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.dish_used || "—"}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{steps.length}</td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No recipes match your filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-xl">
          {selected && <RecipeDetail recipe={selected} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const steps = parseSteps(recipe.recipe);
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl leading-tight">{recipe.product}</DialogTitle>
        <DialogDescription>{recipe.category}</DialogDescription>
        <div className="flex flex-wrap gap-2 pt-2">
          {recipe.dish_used && <Badge variant="secondary">Served in: {recipe.dish_used}</Badge>}
          <Badge variant="outline">{steps.length} {steps.length === 1 ? "step" : "steps"}</Badge>
        </div>
      </DialogHeader>

      {recipe.special_instructions && (
        <div className="border-t border-border pt-4 mt-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Notes</div>
          <p className="text-sm leading-relaxed bg-muted/50 border border-border rounded-md px-3 py-2 italic">
            {recipe.special_instructions}
          </p>
        </div>
      )}

      <div className="border-t border-border pt-4 mt-2">
        <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3">Instructions</div>
        <ol className="space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-medium flex items-center justify-center tabular-nums">
                {i + 1}
              </span>
              <p className="text-sm leading-relaxed pt-0.5">{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
