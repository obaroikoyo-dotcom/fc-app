// County/state options for the countries brands and creators overwhelmingly
// pay from. Stripe expects a 2-letter code for US/CA; for GB it accepts any
// free text, so full county names are used there. Countries without a list
// here fall back to a plain text field.
export const REGIONS_BY_COUNTRY: Record<string, { code: string; name: string }[]> = {
  US: [
    { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" }, { code: "AR", name: "Arkansas" },
    { code: "CA", name: "California" }, { code: "CO", name: "Colorado" }, { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" },
    { code: "DC", name: "District of Columbia" }, { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
    { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" }, { code: "IA", name: "Iowa" },
    { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" }, { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" },
    { code: "MD", name: "Maryland" }, { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
    { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" }, { code: "NE", name: "Nebraska" },
    { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" }, { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" },
    { code: "NY", name: "New York" }, { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
    { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" }, { code: "RI", name: "Rhode Island" },
    { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" }, { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" },
    { code: "UT", name: "Utah" }, { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
    { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" }, { code: "PR", name: "Puerto Rico" },
  ],
  CA: [
    { code: "AB", name: "Alberta" }, { code: "BC", name: "British Columbia" }, { code: "MB", name: "Manitoba" }, { code: "NB", name: "New Brunswick" },
    { code: "NL", name: "Newfoundland and Labrador" }, { code: "NS", name: "Nova Scotia" }, { code: "NT", name: "Northwest Territories" },
    { code: "NU", name: "Nunavut" }, { code: "ON", name: "Ontario" }, { code: "PE", name: "Prince Edward Island" }, { code: "QC", name: "Quebec" },
    { code: "SK", name: "Saskatchewan" }, { code: "YT", name: "Yukon" },
  ],
  GB: [
    "Avon", "Bedfordshire", "Berkshire", "Buckinghamshire", "Cambridgeshire", "Cheshire", "City of London", "Cleveland", "Cornwall",
    "County Durham", "Cumbria", "Derbyshire", "Devon", "Dorset", "East Riding of Yorkshire", "East Sussex", "Essex", "Gloucestershire",
    "Greater London", "Greater Manchester", "Hampshire", "Herefordshire", "Hertfordshire", "Isle of Wight", "Kent", "Lancashire",
    "Leicestershire", "Lincolnshire", "Merseyside", "Norfolk", "North Yorkshire", "Northamptonshire", "Northumberland", "Nottinghamshire",
    "Oxfordshire", "Rutland", "Shropshire", "Somerset", "South Yorkshire", "Staffordshire", "Suffolk", "Surrey", "Tyne and Wear",
    "Warwickshire", "West Midlands", "West Sussex", "West Yorkshire", "Wiltshire", "Worcestershire",
    "Aberdeenshire", "Argyll and Bute", "Edinburgh", "Fife", "Glasgow", "Highland", "Lanarkshire", "Lothian", "Perthshire", "Scottish Borders",
    "Cardiff", "Glamorgan", "Gwynedd", "Powys", "Swansea",
    "Antrim", "Armagh", "Down", "Fermanagh", "Londonderry", "Tyrone",
  ].map(name => ({ code: name, name })),
};
