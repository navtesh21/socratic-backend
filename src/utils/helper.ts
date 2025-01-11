import axios from "axios";

async function validateSlug(slug: string): Promise<boolean> {
  console.log(slug);
  try {
    const query = `
      query ($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
        }
      }
    `;
    const res = await axios.post(
      "https://leetcode.com/graphql",
      {
        query,
        variables: { titleSlug: slug },
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    const response = await res.data.data.question;
    console.log(response, "response");

    if (response) {
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error validating slug:", error);
    return false;
  }
}

export default validateSlug;
