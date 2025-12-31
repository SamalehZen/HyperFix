import { tool } from 'ai';
import { z } from 'zod';
import type { UIMessageStreamWriter } from 'ai';
import type { ChatMessage } from '../types';
import { serverEnv } from '@/env/server';

const SERPER_API_KEY = serverEnv.SERPER_API_KEY;
const SERPER_SEARCH_ENDPOINT = 'https://google.serper.dev/search';
const SERPER_IMAGES_ENDPOINT = 'https://google.serper.dev/images';
const OPEN_FOOD_FACTS_ENDPOINT = 'https://world.openfoodfacts.org/api/v2/product';

interface NutritionScores {
  nutriScore?: { grade?: string; score?: number };
  novaGroup?: number;
  greenScore?: { grade?: string; score?: number };
}

interface NutritionData {
  scores?: NutritionScores;
  nutriments?: Record<string, string | number>;
}

interface SerperSearchResult {
  organic?: Array<{
    title: string;
    link: string;
    snippet: string;
    date?: string;
  }>;
  images?: Array<string | { imageUrl: string; link: string; source?: string }>;
  knowledgeGraph?: {
    title?: string;
    description?: string;
    descriptionSource?: string;
    descriptionLink?: string;
    attributes?: Record<string, string>;
    imageUrl?: string;
    images?: Array<string | { url: string; link: string }>;
  };
}

async function searchSerper(query: string, num: number = 10): Promise<SerperSearchResult> {
  const response = await fetch(SERPER_SEARCH_ENDPOINT, {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: query,
      num,
      gl: 'fr',
      hl: 'fr',
      type: 'search', // Ensure we get all results including images
      autocorrect: true,
    }),
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const result = (await response.json()) as SerperSearchResult;
  console.log(`[Serper] Query: "${query}" - Found ${result.organic?.length || 0} results, ${result.images?.length || 0} images`);
  
  return result;
}

async function searchSerperImages(query: string, num: number = 20): Promise<{ images?: Array<{ imageUrl: string; link: string; title?: string }> }> {
  try {
    const response = await fetch(SERPER_IMAGES_ENDPOINT, {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_API_KEY as string,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num,
        gl: 'fr',
        hl: 'fr',
      }),
    });

    if (!response.ok) {
      console.warn(`Serper Images API error: ${response.status}`);
      return { images: [] };
    }

    const result = await response.json();
    console.log(`[Serper Images] Query: "${query}" - Found ${result.images?.length || 0} images`);
    
    return result;
  } catch (error) {
    console.warn('[Serper Images] Failed to fetch images:', error);
    return { images: [] };
  }
}

function formatNutrimentsFromOpenFoodFacts(nutrimentsRaw: Record<string, any> | undefined): Record<string, string> {
  if (!nutrimentsRaw) return {};

  const result: Record<string, string> = {};

  const nutrientsConfig: Array<{ id: string; label: string; defaultUnit?: string }> = [
    { id: 'energy-kcal', label: 'Énergie (kcal)', defaultUnit: 'kcal' },
    { id: 'energy', label: 'Énergie (kJ)', defaultUnit: 'kJ' },
    { id: 'fat', label: 'Matières grasses', defaultUnit: 'g' },
    { id: 'saturated-fat', label: 'Dont acides gras saturés', defaultUnit: 'g' },
    { id: 'carbohydrates', label: 'Glucides', defaultUnit: 'g' },
    { id: 'sugars', label: 'Sucres', defaultUnit: 'g' },
    { id: 'fiber', label: 'Fibres', defaultUnit: 'g' },
    { id: 'proteins', label: 'Protéines', defaultUnit: 'g' },
    { id: 'salt', label: 'Sel', defaultUnit: 'g' },
    { id: 'sodium', label: 'Sodium', defaultUnit: 'g' },
    { id: 'fruits-vegetables-nuts', label: 'Fruits, légumes et noix', defaultUnit: '%' },
  ];

  nutrientsConfig.forEach(({ id, label, defaultUnit }) => {
    const unit = nutrimentsRaw[`${id}_unit`] || defaultUnit;

    const per100g = nutrimentsRaw[`${id}_100g`];
    if (per100g !== undefined && per100g !== null) {
      const formattedUnit = unit ? ` ${unit}` : '';
      result[`${label} (pour 100g)`] = `${per100g}${formattedUnit}`;
    }

    const perServing = nutrimentsRaw[`${id}_serving`];
    if (perServing !== undefined && perServing !== null) {
      const formattedUnit = unit ? ` ${unit}` : '';
      result[`${label} (par portion)`] = `${perServing}${formattedUnit}`;
    }

    const dailyValue = nutrimentsRaw[`${id}_percent_daily_value`];
    if (dailyValue !== undefined && dailyValue !== null) {
      result[`${label} (% AJR)`] = `${dailyValue} %`;
    }
  });

  return result;
}

async function fetchNutritionData(barcode: string): Promise<NutritionData | undefined> {
  try {
    const response = await fetch(`${OPEN_FOOD_FACTS_ENDPOINT}/${barcode}.json`);

    if (!response.ok) {
      console.warn(`[Open Food Facts] No data found for barcode ${barcode}`);
      return undefined;
    }

    const data = await response.json();
    const product = data?.product;

    if (!product) {
      console.warn(`[Open Food Facts] No product data for barcode ${barcode}`);
      return undefined;
    }

    const scores: NutritionScores = {};

    if (product.nutriscore_grade || product.nutriscore_score !== undefined) {
      scores.nutriScore = {
        grade: product.nutriscore_grade?.toUpperCase(),
        score: product.nutriscore_score,
      };
    }

    if (product.nova_group) {
      scores.novaGroup = product.nova_group;
    }

    if (product.ecoscore_grade || product.ecoscore_score !== undefined) {
      scores.greenScore = {
        grade: product.ecoscore_grade?.toUpperCase(),
        score: product.ecoscore_score,
      };
    }

    const nutriments = formatNutrimentsFromOpenFoodFacts(product.nutriments);

    console.log(`[Open Food Facts] Found nutrition data for barcode ${barcode}:`, {
      hasScores: Object.keys(scores).length > 0,
      hasNutriments: Object.keys(nutriments).length > 0,
    });

    return {
      scores: Object.keys(scores).length > 0 ? scores : undefined,
      nutriments: Object.keys(nutriments).length > 0 ? nutriments : undefined,
    };
  } catch (error) {
    console.warn('[Open Food Facts] Failed to fetch nutrition data:', error);
    return undefined;
  }
}

// No domain filtering - accept ALL results from Serper
const hostToBrandFallback: Record<string, string> = {
  'www.barcodelookup.com': 'Barcode Lookup',
  'barcodelookup.com': 'Barcode Lookup',
  'go-upc.com': 'Go-UPC',
  'www.gs1.org': 'GS1',
  'www.eandata.com': 'EANData',
  'www.upcindex.com': 'UPC Index',
  'www.carrefour.fr': 'Carrefour',
  'carrefour.fr': 'Carrefour',
  'carrefour-express.fr': 'Carrefour Express',
  'fr.openfoodfacts.org': 'Open Food Facts',
  'world.openfoodfacts.org': 'Open Food Facts',
  'amazon.fr': 'Amazon',
  'www.amazon.fr': 'Amazon',
  'www.auchan.fr': 'Auchan',
  'auchan.fr': 'Auchan',
  'www.leclerc.com': 'Leclerc',
  'leclerc.com': 'Leclerc',
  'www.intermarche.com': 'Intermarché',
  'intermarche.com': 'Intermarché',
}

function getHostname(value: string): string | null {
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function deriveBrand(title: string, content: string, hostname: string | null): string | undefined {
  const haystack = `${title}\n${content}`.split(/\n|\.|\r/);
  for (const segment of haystack) {
    const match = segment.match(/\b(?:brand|marque)\s*[:\-]\s*([^\n\r]+)/i);
    if (match) {
      const raw = match[1].trim();
      if (raw) {
        return raw.replace(/\s{2,}/g, ' ');
      }
    }
  }

  if (hostname) {
    const fallback = hostToBrandFallback[hostname] || hostToBrandFallback[hostname.replace(/^www\./, '')];
    if (fallback) {
      return fallback;
    }
  }

  const titleMatch = title.match(/^[^|-]+/);
  if (titleMatch) {
    const possible = titleMatch[0].trim();
    if (possible && possible.length <= 40) {
      return possible;
    }
  }

  return undefined;
}

function extractNutrients(attributes: Record<string, string> | undefined): Record<string, string | number> {
  if (!attributes) return {};

  const nutritionKeys = [
    'calories', 'énergie', 'energy',
    'protéines', 'protein', 'proteins',
    'graisses', 'lipides', 'fat', 'fats',
    'glucides', 'carbohydrates', 'carbs',
    'sucres', 'sugar', 'sugars',
    'sodium', 'sel', 'salt',
    'fibres', 'fiber', 'fibers', 'fibres alimentaires',
    'calcium', 'fer', 'iron', 'magnésium', 'potassium',
    'vitamine', 'vitamin',
  ];

  const nutrients: Record<string, string | number> = {};

  Object.entries(attributes).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (nutritionKeys.some(nKey => lowerKey.includes(nKey)) && value && value.trim()) {
      nutrients[key] = value;
    }
  });

  return nutrients;
}

type ProductSearchResult = {
  title: string;
  url: string;
  content: string;
  price?: string;
  images: string[];
  supplier?: string;
  ean: string;
  publishedDate?: string;
  favicon?: string;
  description?: string;
};

export function eanSearchTool(dataStream: UIMessageStreamWriter<ChatMessage> | undefined) {
  return tool({
    description:
      'Search for product information using EAN/UPC barcode or product label/name. Returns detailed product information including title, description, images, price, and suppliers. Use this tool when the user provides either a barcode number (8-13 digits for EAN-13, EAN-8, or UPC) OR a product label/name.',
    inputSchema: z.object({
      query: z.string().describe('Either an EAN/UPC barcode number (8-13 digits) or a product label/name to search for'),
      searchType: z.enum(['auto', 'barcode', 'label']).describe('Type of search: auto (auto-detect), barcode (EAN/UPC only), or label (product name)').optional().default('auto'),
    }),
    execute: async ({ query, searchType = 'auto' }) => {
      let isBarcode = false;
      let isLabel = false;
      let searchQuery = query;
      let identifier = query;

      // Determine search type
      if (searchType === 'auto') {
        // Auto-detect: if query is 8-13 digits, treat as barcode
        isBarcode = /^\d{8,13}$/.test(query);
        isLabel = !isBarcode;
      } else if (searchType === 'barcode') {
        isBarcode = true;
        isLabel = false;
        if (!/^\d{8,13}$/.test(query)) {
          throw new Error('Invalid barcode format. EAN codes must be 8-13 digits.');
        }
      } else if (searchType === 'label') {
        isLabel = true;
        isBarcode = false;
      }

      try {
        // Build search query based on type
        if (isBarcode) {
          searchQuery = `EAN ${query}`;
        } else if (isLabel) {
          searchQuery = query; // Use the label as-is for product search
        }

        console.log(`[EAN Search] Search type: ${isBarcode ? 'BARCODE' : 'LABEL'} - Query: "${searchQuery}"`);

        // Fetch nutrition data from Open Food Facts if it's a barcode
        let nutritionData: NutritionData | undefined;
        if (isBarcode) {
          nutritionData = await fetchNutritionData(query);
        }

        // Run both text and image searches in parallel
        const [serperResults, imageResults] = await Promise.all([
          searchSerper(searchQuery, 20),
          searchSerperImages(searchQuery),
        ]);

        const collectedResults: ProductSearchResult[] = [];
        const collectedImages: string[] = [];

        // Collect images from dedicated image search first (best quality)
        if (imageResults.images && Array.isArray(imageResults.images)) {
          imageResults.images.forEach((img) => {
            if (img && typeof img === 'object' && 'imageUrl' in img) {
              collectedImages.push(img.imageUrl);
            } else if (typeof img === 'string') {
              collectedImages.push(img);
            }
          });
          console.log(`[EAN Search] Collected ${imageResults.images.length} images from dedicated image search`);
        }

        // Accept ALL organic results from Serper (no domain filtering)
        if (serperResults.organic) {
          for (const result of serperResults.organic) {
            const url = result.link;
            const hostname = url ? getHostname(url) : null;
            const content = result.snippet || '';
            const brand = deriveBrand(result.title || '', content, hostname);

            collectedResults.push({
              title: result.title || '',
              url,
              content,
              images: [],
              supplier: brand || undefined,
              ean: identifier,
              publishedDate: result.date || undefined,
            });
          }
        }

        // Collect images from Knowledge Graph first (higher quality)
        if (serperResults.knowledgeGraph?.imageUrl) {
          collectedImages.push(serperResults.knowledgeGraph.imageUrl);
        }

        // Collect images from Knowledge Graph array
        if (serperResults.knowledgeGraph?.images && Array.isArray(serperResults.knowledgeGraph.images)) {
          serperResults.knowledgeGraph.images.forEach((img) => {
            if (typeof img === 'string') {
              collectedImages.push(img);
            } else if (img && typeof img === 'object' && 'url' in img) {
              collectedImages.push(img.url);
            }
          });
        }

        // Collect images from main search results
        if (serperResults.images && Array.isArray(serperResults.images)) {
          serperResults.images.forEach((img) => {
            if (typeof img === 'string') {
              collectedImages.push(img);
            } else if (img && typeof img === 'object' && 'imageUrl' in img) {
              collectedImages.push(img.imageUrl);
            }
          });
        }

        const seenUrls = new Set<string>();
        const finalResults: ProductSearchResult[] = [];
        for (const result of collectedResults) {
          if (!result.url || seenUrls.has(result.url)) continue;
          seenUrls.add(result.url);
          finalResults.push(result);
        }

        // Deduplicate and filter valid images (must be proper URLs)
        const finalImages = Array.from(new Set(collectedImages))
          .filter(img => {
            try {
              new URL(img);
              return true;
            } catch {
              return false;
            }
          })
          .slice(0, 12);

        console.log(`[EAN Search] Found ${collectedImages.length} images (${finalImages.length} after filtering) for query "${searchQuery}"`);

        // Build description from Knowledge Graph
        let fullDescription = '';
        let extractedNutrients: Record<string, string | number> = {};

        if (serperResults.knowledgeGraph) {
          const kg = serperResults.knowledgeGraph;
          if (kg.title) {
            fullDescription += `${kg.title}\n\n`;
          }
          if (kg.description) {
            fullDescription += `${kg.description}\n\n`;
          }
          if (kg.attributes) {
            const allAttributes = kg.attributes;

            // Extract nutrients
            extractedNutrients = extractNutrients(allAttributes);

            // Add all attributes except nutrition ones
            Object.entries(allAttributes).forEach(([key, value]) => {
              const lowerKey = key.toLowerCase();
              const nutritionKeys = ['calories', 'énergie', 'energy', 'protéines', 'protein', 'graisses', 'lipides', 'fat', 'glucides', 'carbohydrates', 'sucres', 'sugar', 'sodium', 'sel', 'fibres', 'fiber', 'calcium', 'fer', 'iron', 'magnésium', 'potassium', 'vitamine', 'vitamin'];

              if (!nutritionKeys.some(nKey => lowerKey.includes(nKey))) {
                fullDescription += `${key}: ${value}\n`;
              }
            });
            fullDescription += '\n';
          }
        }

        // Merge nutriments from Open Food Facts if available
        if (nutritionData?.nutriments) {
          extractedNutrients = {
            ...extractedNutrients,
            ...nutritionData.nutriments,
          };
        }

        const errorMessage = isBarcode
          ? 'Aucun résultat trouvé pour ce code-barres.'
          : 'Aucun résultat trouvé pour ce produit.';

        if (finalResults.length === 0 && finalImages.length === 0 && !fullDescription) {
          return {
            barcode: identifier,
            results: [],
            images: [],
            totalResults: 0,
            message: errorMessage,
          } as const;
        }

        // Limit to top 8 results
        finalResults.splice(8);

        // Add content from top results to description
        finalResults.slice(0, 3).forEach((result) => {
          if (result.content) {
            fullDescription += `${result.content}\n\n`;
          }
        });

        const searchTypeLabel = isBarcode ? 'barcode' : 'label';
        return {
          barcode: identifier,
          results: finalResults,
          images: finalImages,
          totalResults: finalResults.length,
          description: fullDescription.trim() || undefined,
          message: `Found ${finalResults.length} results for ${searchTypeLabel} "${query}"`,
          nutritionScores: nutritionData?.scores,
          nutrients: Object.keys(extractedNutrients).length > 0 ? extractedNutrients : undefined,
        };
      } catch (err) {
        console.error('[EAN Search] Error:', err);
        const errorType = isBarcode ? 'code-barres' : 'produit';
        return {
          barcode: identifier,
          results: [],
          images: [],
          totalResults: 0,
          description: undefined,
          message: `Erreur lors de la recherche du ${errorType}.`,
          error: (err as Error)?.message || 'Unknown error',
        } as const;
      }
    },
  });
}
