import { draftMode } from "next/headers"
import { notFound } from "next/navigation"
import { getDraftData } from "next-drupal/draft"
import { Article } from "@/components/drupal/Article"
import { BasicPage } from "@/components/drupal/BasicPage"
import { drupal } from "@/lib/drupal"
import type { Metadata, ResolvingMetadata } from "next"
import type { DrupalNode, JsonApiParams } from "next-drupal"

async function getNode(slug: string[]) {
  const path = slug.join("/")

  const params: JsonApiParams = {}

  const draftData = getDraftData()

  if (draftData.slug === `/${path}`) {
    params.resourceVersion = draftData.resourceVersion
  }

  // Translating the path also allows us to discover the entity type.
  const translatedPath = await drupal.translatePath(path)

  if (!translatedPath) {
    throw new Error("Resource not found", { cause: "NotFound" })
  }

  const type = translatedPath.jsonapi?.resourceName!
  const uuid = translatedPath.entity.uuid

  if (type === "node--article") {
    params.include = "field_image,uid"
  }

  const resource = await drupal.getResource<DrupalNode>(type, uuid, {
    params,
  })

  if (!resource) {
    throw new Error(
      `Failed to fetch resource: ${translatedPath?.jsonapi?.individual}`,
      {
        cause: "DrupalError",
      }
    )
  }

  return resource
}

type NodePageParams = {
  slug: string[]
}
type NodePageProps = {
  params: NodePageParams
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata(
  { params: { slug } }: NodePageProps,
  parent: ResolvingMetadata
): Promise<Metadata> {
  let node
  try {
    node = await getNode(slug)
  } catch (e) {
    // If we fail to fetch the node, don't return any metadata.
    return {}
  }

  return {
    title: node.title,
  }
}

const RESOURCE_TYPES = ["node--page", "node--article"]

export async function generateStaticParams(): Promise<NodePageParams[]> {
  // TODO: Replace getStaticPathsFromContext() usage since there is no context.
  const paths = await drupal.getStaticPathsFromContext(RESOURCE_TYPES, {})
  // console.log(
  //   "generateStaticParams",
  //   paths.map(({ params }) => params)
  // )
  return paths.map((path: string | { params: NodePageParams }) =>
    typeof path === "string" ? { slug: [] } : path?.params
  )
}

export default async function NodePage({
  params: { slug },
  searchParams,
}: NodePageProps) {
  const isDraftMode = draftMode().isEnabled

  let node
  try {
    node = await getNode(slug)
  } catch (error) {
    // If getNode throws an error, tell Next.js the path is 404.
    notFound()
  }

  // If we're not in draft mode and the resource is not published, return a 404.
  if (!isDraftMode && node?.status === false) {
    notFound()
  }

  return (
    <>
      {node.type === "node--page" && <BasicPage node={node} />}
      {node.type === "node--article" && <Article node={node} />}
    </>
  )
}
