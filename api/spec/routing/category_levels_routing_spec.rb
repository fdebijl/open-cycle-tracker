require "rails_helper"

RSpec.describe CategoryLevelsController, type: :routing do
  describe "routing" do
    it "routes to #index" do
      expect(get: "/category_levels").to route_to("category_levels#index")
    end

    it "routes to #show" do
      expect(get: "/category_levels/1").to route_to("category_levels#show", id: "1")
    end


    it "routes to #create" do
      expect(post: "/category_levels").to route_to("category_levels#create")
    end

    it "routes to #update via PUT" do
      expect(put: "/category_levels/1").to route_to("category_levels#update", id: "1")
    end

    it "routes to #update via PATCH" do
      expect(patch: "/category_levels/1").to route_to("category_levels#update", id: "1")
    end

    it "routes to #destroy" do
      expect(delete: "/category_levels/1").to route_to("category_levels#destroy", id: "1")
    end
  end
end
