class CategoriesController < ApplicationController
  before_action :find_category, only: [:show, :update, :destroy]
  before_action :find_categories, only: [:index, :filter]

  def index
    authorize @categories
    render json: @categories
  end

  def show
    authorize @category
    render json: @category
  end

  def filter
    @categories = @categories.where(id: permitted_attributes(resource_class)[:id]) if params[:filter].key?(:id)

    authorize @categories
    render json: @categories
  end

  def create
    @category = resource_class.new create_params

    if @category.save
      authorize @category
      render json: @category, status: :created, location: @category
    else
      skip_authorization
      render json: @category.errors, status: :unprocessable_entity
    end
  end

  def update
    throw NotImplementedError
  end

  def destroy
    throw NotImplementedError
  end

  protected

  def create_params
    permitted_attributes(resource_class)
  end

  def update_params
    permitted_attributes(@category)
  end

  def find_category
    @category = policy_scope(resource_class).find(params[:id])
  end

  def find_categories
    @categories = policy_scope(resource_class)
  end
end
