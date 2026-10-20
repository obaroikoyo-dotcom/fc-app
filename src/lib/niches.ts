// The niches a campaign, a creator or a filter can use. One list for the whole
// app: posting a campaign, picking your own niches, and every filter menu read
// from here, so a niche that can be picked can also be filtered on. Niches are
// stored as plain text, so adding one here needs no database change.
// The first twenty keep their original order; new ones go on the end.
export const NICHES = [
  "Tech", "Beauty", "Fitness", "Gaming", "Fashion", "Food", "Travel", "Lifestyle", "Finance", "Parenting",
  "Education", "Sports", "Music", "Comedy", "Art", "Wellness", "Pets", "DIY", "Business", "Automotive",
  "Health", "Home & Garden", "Photography", "Books", "Skincare", "Makeup", "Luxury", "Streetwear", "Sustainability", "Outdoors",
  "Entertainment", "Dance", "Cooking", "Family", "Weddings", "Student Life", "Careers", "Anime", "Podcasts", "Property",
];

// A long menu is easier to scan in alphabetical order.
export const NICHES_A_TO_Z = [...NICHES].sort((a, b) => a.localeCompare(b));
