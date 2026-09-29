# Modules

Each product capability owns a module under this directory. Keep the dependency direction:

`route -> service -> repository -> Prisma`

Routes handle HTTP concerns and Zod validation. Services contain business rules and transactions. Repositories own tenant-scoped data access. Product modules are added only when their API and data requirements are in scope.
