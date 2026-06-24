// Shared types for the API/data layer.
//
// `DbRow` is the honest type for a row coming back from an untyped Supabase
// query (`.select("*")` etc.): the shape isn't known to the compiler until DB
// types are generated (`supabase gen types typescript`). The mappers below turn
// these loose rows into typed camelCase domain models — which ARE the valuable
// contract the app consumes. When generated DB types land, swap `DbRow` for the
// real `Database["public"]["Tables"][...]["Row"]` types.
export type DbRow = Record<string, any>;
