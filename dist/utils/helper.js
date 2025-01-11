"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
function validateSlug(slug) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log(slug);
        try {
            const query = `
      query ($titleSlug: String!) {
        question(titleSlug: $titleSlug) {
          questionId
        }
      }
    `;
            const res = yield axios_1.default.post("https://leetcode.com/graphql", {
                query,
                variables: { titleSlug: slug },
            }, {
                headers: { "Content-Type": "application/json" },
            });
            const response = yield res.data.data.question;
            console.log(response, "response");
            if (response) {
                return true;
            }
            return false;
        }
        catch (error) {
            console.error("Error validating slug:", error);
            return false;
        }
    });
}
exports.default = validateSlug;
