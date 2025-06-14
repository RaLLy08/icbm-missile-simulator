## Project Structure


## Naming rules
Folders should be named in lowercase and words should be separated by hyphens. For example: `my-folder-name`.

Nested files:
Don't repeat the name of the parent folder in the name of the child folder. For example, if you have a folder named `components`, don't create a child folder named `components` inside it.
Or for example if you have a folder `Carousel`, don't create a children file named as `CarouselButton` or `CarouselItem`.

### Scenes: Main Pages

- **components/**:
  - Contains only layout and render logic that depends solely on props (e.g., constant fields, texts, translations). No business logic should be present.
- **\*.containers.tsx**:
  - Contains business logic (interaction with redux-store) and may include layout. Ideally, layout should be minimized here.
  - Their primary focus should be on handling business logic with minimal layout handling.
- **\*.tsx/**:
  - Parts of the layout page to create connections and logic between containers or mixed
- **\*.layout.tsx**: Can include both layout and other elements. However, it is preferable to avoid including business logic in these files.
  - Files responsible for routing and layout of the page, for each router url a layout file must be created
  - Can inlude `Outlet` for nested routes
  - Can include both layout and other elements. However, it is preferable to avoid including business logic in these files.
  
### Import Rules

Imports should follow a top-to-bottom hierarchy to maintain clarity and structure within the project:

- **Components (`*.component.tsx`)**:
  - Components can be imported and used within other components.
  - Components can be imported into lower layers, such as in `*.containers.tsx`, `*.tsx` and `*.layout.tsx` files.
- **Business Logic Files (`*.containers.tsx`)**:
  - Can import only components.
- **Mixed Logic Files (`*.tsx`)**:
  - Can import components and containers.
- **Layout Files (`*.layout.tsx`)**:
  - Can import everything.

## Launch instructions

Create /config/.env file according .env.EXAMPLE file.
Install all packages then run `npm run build` to build prod version.
